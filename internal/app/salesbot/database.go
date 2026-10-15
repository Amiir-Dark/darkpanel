package salesbot

import (
	"database/sql"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

var (
	dbMu   sync.Mutex
	dbConn *sql.DB
	dbPath string
)

type User struct {
	TelegramID    int64     `json:"telegram_id"`
	Username      string    `json:"username"`
	FirstName     string    `json:"first_name"`
	WalletBalance float64   `json:"wallet_balance"`
	PanelUsername string    `json:"panel_username"`
	SubURL        string    `json:"sub_url"`
	ServiceStatus string    `json:"service_status"`
	TotalSpent    float64   `json:"total_spent"`
	CreatedAt     time.Time `json:"created_at"`
}

type Order struct {
	ID          int64     `json:"id"`
	UserID      int64     `json:"user_id"`
	Username    string    `json:"username"`
	FirstName   string    `json:"first_name"`
	AmountBase  float64   `json:"amount_base"`
	AmountExact float64   `json:"amount_exact"`
	Code        string    `json:"code"`
	Status      string    `json:"status"` // pending, paid, expired, cancelled
	BankRef     string    `json:"bank_ref"`
	CreatedAt   time.Time `json:"created_at"`
	ExpiresAt   time.Time `json:"expires_at"`
}

type Receipt struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	Username  string    `json:"username"`
	FirstName string    `json:"first_name"`
	Amount    float64   `json:"amount"`
	FileID    string    `json:"file_id"`
	Status    string    `json:"status"` // pending, approved, rejected
	CreatedAt time.Time `json:"created_at"`
}

// resolveDBPath finds or creates the SQLite path
func resolveDBPath() string {
	if p := strings.TrimSpace(os.Getenv("BOT_DATABASE_PATH")); p != "" {
		return p
	}
	candidates := []string{
		"/opt/darkpanel/bot.db",
		"/opt/darkpanel/bot/bot.db",
		"/opt/rebecca/bot/bot.db",
		"bot/bot.db",
		"bot.db",
	}
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && !fi.IsDir() {
			return c
		}
	}
	if _, err := os.Stat("/opt/darkpanel"); err == nil {
		_ = os.MkdirAll("/opt/darkpanel/bot", 0755)
		return "/opt/darkpanel/bot/bot.db"
	}
	_ = os.MkdirAll("bot", 0755)
	return "bot/bot.db"
}

// GetDB returns the database connection with WAL and required schemas
func GetDB() (*sql.DB, string, error) {
	dbMu.Lock()
	defer dbMu.Unlock()

	if dbConn != nil {
		if err := dbConn.Ping(); err == nil {
			return dbConn, dbPath, nil
		}
		_ = dbConn.Close()
		dbConn = nil
	}

	path := resolveDBPath()
	conn, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, path, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	conn.SetMaxOpenConns(4)
	conn.SetMaxIdleConns(2)
	conn.SetConnMaxLifetime(time.Hour)

	_, _ = conn.Exec("PRAGMA journal_mode = WAL;")
	_, _ = conn.Exec("PRAGMA busy_timeout = 10000;")
	_, _ = conn.Exec("PRAGMA synchronous = NORMAL;")

	schema := `
	CREATE TABLE IF NOT EXISTS users (
		telegram_id INTEGER PRIMARY KEY,
		username TEXT DEFAULT '',
		first_name TEXT DEFAULT '',
		wallet_balance REAL DEFAULT 0,
		panel_username TEXT DEFAULT '',
		sub_url TEXT DEFAULT '',
		service_status TEXT DEFAULT 'none',
		total_spent REAL DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS receipts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		amount REAL NOT NULL,
		file_id TEXT NOT NULL,
		status TEXT DEFAULT 'pending',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS usage_tracking (
		user_id INTEGER PRIMARY KEY,
		panel_username TEXT NOT NULL,
		last_synced_bytes INTEGER DEFAULT 0,
		total_billed_bytes INTEGER DEFAULT 0,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS user_states (
		user_id INTEGER PRIMARY KEY,
		state TEXT DEFAULT '',
		data TEXT DEFAULT ''
	);

	CREATE TABLE IF NOT EXISTS orders (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		amount_base REAL NOT NULL,
		amount_exact REAL NOT NULL,
		code TEXT NOT NULL,
		status TEXT DEFAULT 'pending',
		bank_ref TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, expires_at);
	CREATE INDEX IF NOT EXISTS idx_orders_exact ON orders(amount_exact);
	`
	if _, err := conn.Exec(schema); err != nil {
		_ = conn.Close()
		return nil, path, fmt.Errorf("failed to initialize schema: %w", err)
	}

	dbConn = conn
	dbPath = path
	return dbConn, dbPath, nil
}

// Settings helpers
func GetSetting(key, defaultVal string) string {
	db, _, err := GetDB()
	if err != nil {
		return defaultVal
	}
	var val string
	err = db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&val)
	if err != nil || strings.TrimSpace(val) == "" {
		return defaultVal
	}
	return val
}

func SetSetting(key, val string) error {
	db, _, err := GetDB()
	if err != nil {
		return err
	}
	_, err = db.Exec(`
		INSERT INTO settings (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, val)
	return err
}

func GetSettingFloat(key string, defaultVal float64) float64 {
	valStr := GetSetting(key, "")
	if valStr == "" {
		return defaultVal
	}
	if v, err := strconv.ParseFloat(valStr, 64); err == nil {
		return v
	}
	return defaultVal
}

func GetSettingInt(key string, defaultVal int) int {
	valStr := GetSetting(key, "")
	if valStr == "" {
		return defaultVal
	}
	if v, err := strconv.Atoi(valStr); err == nil {
		return v
	}
	return defaultVal
}

// User state helpers
func GetUserState(userID int64) (string, string) {
	db, _, err := GetDB()
	if err != nil {
		return "", ""
	}
	var state, data string
	_ = db.QueryRow(`SELECT state, data FROM user_states WHERE user_id = ?`, userID).Scan(&state, &data)
	return state, data
}

func SetUserState(userID int64, state, data string) {
	db, _, err := GetDB()
	if err != nil {
		return
	}
	_, _ = db.Exec(`
		INSERT INTO user_states (user_id, state, data) VALUES (?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, data = excluded.data`,
		userID, state, data)
}

func ClearUserState(userID int64) {
	db, _, err := GetDB()
	if err != nil {
		return
	}
	_, _ = db.Exec(`DELETE FROM user_states WHERE user_id = ?`, userID)
}

// User operations
func GetOrCreateUser(tgID int64, username, firstName string) (*User, error) {
	db, _, err := GetDB()
	if err != nil {
		return nil, err
	}

	var u User
	var createdAtStr string
	err = db.QueryRow(`
		SELECT telegram_id, username, first_name, wallet_balance, panel_username, sub_url, service_status, total_spent, created_at 
		FROM users WHERE telegram_id = ?`, tgID).Scan(
		&u.TelegramID, &u.Username, &u.FirstName, &u.WalletBalance, &u.PanelUsername, &u.SubURL, &u.ServiceStatus, &u.TotalSpent, &createdAtStr,
	)
	if err == sql.ErrNoRows {
		now := time.Now()
		_, err := db.Exec(`
			INSERT INTO users (telegram_id, username, first_name, created_at) 
			VALUES (?, ?, ?, ?)`, tgID, username, firstName, now.Format("2006-01-02 15:04:05"))
		if err != nil {
			return nil, err
		}
		return &User{
			TelegramID:    tgID,
			Username:      username,
			FirstName:     firstName,
			WalletBalance: 0,
			ServiceStatus: "none",
			CreatedAt:     now,
		}, nil
	}
	if err != nil {
		return nil, err
	}

	// Update username/firstName if changed
	if u.Username != username || u.FirstName != firstName {
		_, _ = db.Exec(`UPDATE users SET username = ?, first_name = ? WHERE telegram_id = ?`, username, firstName, tgID)
		u.Username = username
		u.FirstName = firstName
	}
	u.CreatedAt = parseTimeStr(createdAtStr)
	return &u, nil
}

// Generate5MinOrder creates a 5-minute order with a randomized 3-digit tail
func Generate5MinOrder(userID int64, amountBase float64) (*Order, error) {
	db, _, err := GetDB()
	if err != nil {
		return nil, err
	}

	// Cancel previous pending orders for this user
	_, _ = db.Exec(`UPDATE orders SET status = 'cancelled' WHERE user_id = ? AND status = 'pending'`, userID)

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	var code string
	var amountExact float64

	// Try up to 100 times to find a collision-free 3-digit tail
	for attempts := 0; attempts < 100; attempts++ {
		tail := r.Intn(900) + 100 // 100..999
		code = fmt.Sprintf("%03d", tail)
		amountExact = (float64(int64(amountBase)/1000) * 1000) + float64(tail)

		var count int
		_ = db.QueryRow(`
			SELECT COUNT(*) FROM orders 
			WHERE status = 'pending' AND expires_at > datetime('now') AND amount_exact = ?`,
			amountExact).Scan(&count)

		if count == 0 {
			break
		}
	}

	now := time.Now()
	expiresAt := now.Add(5 * time.Minute)

	res, err := db.Exec(`
		INSERT INTO orders (user_id, amount_base, amount_exact, code, status, created_at, expires_at)
		VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
		userID, amountBase, amountExact, code,
		now.Format("2006-01-02 15:04:05"),
		expiresAt.Format("2006-01-02 15:04:05"))
	if err != nil {
		return nil, err
	}

	id, _ := res.LastInsertId()
	return &Order{
		ID:          id,
		UserID:      userID,
		AmountBase:  amountBase,
		AmountExact: amountExact,
		Code:        code,
		Status:      "pending",
		CreatedAt:   now,
		ExpiresAt:   expiresAt,
	}, nil
}

func parseTimeStr(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	for _, l := range []string{
		"2006-01-02 15:04:05",
		time.RFC3339,
		"2006-01-02",
	} {
		if t, err := time.Parse(l, s); err == nil {
			return t
		}
	}
	return time.Time{}
}
