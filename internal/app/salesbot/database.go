package salesbot

import (
	"database/sql"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
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
	HasUsedTest   bool      `json:"has_used_test"`
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

	// 1. Check existing files in all common candidate locations first so we never split databases
	candidates := []string{
		"/opt/darkpanel/bot/bot.db",
		"/opt/rebecca/bot/bot.db",
		"/var/lib/darkpanel/bot/bot.db",
		"/var/lib/rebecca/bot/bot.db",
		"/opt/rebecca/data/bot.db",
		"bot/bot.db",
		"bot.db",
	}
	if dataDir := strings.TrimSpace(os.Getenv("REBECCA_DATA_DIR")); dataDir != "" {
		candidates = append([]string{filepath.Join(dataDir, "bot", "bot.db")}, candidates...)
	}
	if appDir := strings.TrimSpace(os.Getenv("REBECCA_APP_DIR")); appDir != "" {
		candidates = append([]string{filepath.Join(appDir, "bot", "bot.db")}, candidates...)
	}

	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && !fi.IsDir() {
			return c
		}
	}

	// 2. If no existing file found, prefer standard data directory
	if dataDir := strings.TrimSpace(os.Getenv("REBECCA_DATA_DIR")); dataDir != "" {
		_ = os.MkdirAll(filepath.Join(dataDir, "bot"), 0755)
		return filepath.Join(dataDir, "bot", "bot.db")
	}
	if appDir := strings.TrimSpace(os.Getenv("REBECCA_APP_DIR")); appDir != "" {
		_ = os.MkdirAll(filepath.Join(appDir, "bot"), 0755)
		return filepath.Join(appDir, "bot", "bot.db")
	}
	if _, err := os.Stat("/opt/darkpanel"); err == nil {
		_ = os.MkdirAll("/opt/darkpanel/bot", 0755)
		return "/opt/darkpanel/bot/bot.db"
	}
	if _, err := os.Stat("/opt/rebecca"); err == nil {
		_ = os.MkdirAll("/opt/rebecca/bot", 0755)
		return "/opt/rebecca/bot/bot.db"
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

	CREATE TABLE IF NOT EXISTS webhook_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		sender TEXT DEFAULT '',
		bank TEXT DEFAULT '',
		raw_payload TEXT DEFAULT '',
		sms_text TEXT DEFAULT '',
		extracted_amount REAL DEFAULT 0,
		bank_ref TEXT DEFAULT '',
		matched INTEGER DEFAULT 0,
		order_id INTEGER NULL,
		user_id INTEGER NULL,
		status TEXT DEFAULT 'received',
		message TEXT DEFAULT ''
	);

	CREATE INDEX IF NOT EXISTS idx_webhook_logs_date ON webhook_logs(received_at DESC);

	CREATE TABLE IF NOT EXISTS gift_codes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		code TEXT UNIQUE NOT NULL,
		amount REAL NOT NULL,
		max_uses INTEGER DEFAULT 1,
		used_count INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS gift_code_redemptions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		code TEXT NOT NULL,
		amount REAL NOT NULL,
		redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(user_id, code)
	);
	`
	if _, err := conn.Exec(schema); err != nil {
		_ = conn.Close()
		return nil, path, fmt.Errorf("failed to initialize schema: %w", err)
	}

	// Migrate any missing columns in existing SQLite tables
	colMigrations := []string{
		"ALTER TABLE users ADD COLUMN username TEXT DEFAULT '';",
		"ALTER TABLE users ADD COLUMN first_name TEXT DEFAULT '';",
		"ALTER TABLE users ADD COLUMN wallet_balance REAL DEFAULT 0;",
		"ALTER TABLE users ADD COLUMN panel_username TEXT DEFAULT '';",
		"ALTER TABLE users ADD COLUMN sub_url TEXT DEFAULT '';",
		"ALTER TABLE users ADD COLUMN service_status TEXT DEFAULT 'none';",
		"ALTER TABLE users ADD COLUMN total_spent REAL DEFAULT 0;",
		"ALTER TABLE users ADD COLUMN has_used_test INTEGER DEFAULT 0;",
		"ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;",
		"ALTER TABLE orders ADD COLUMN bank_ref TEXT DEFAULT '';",
		"ALTER TABLE orders ADD COLUMN code TEXT DEFAULT '';",
		"ALTER TABLE webhook_logs ADD COLUMN order_id INTEGER NULL;",
		"ALTER TABLE webhook_logs ADD COLUMN user_id INTEGER NULL;",
		"ALTER TABLE webhook_logs ADD COLUMN status TEXT DEFAULT 'received';",
		"ALTER TABLE webhook_logs ADD COLUMN message TEXT DEFAULT '';",
	}
	for _, m := range colMigrations {
		_, _ = conn.Exec(m)
	}

	dbConn = conn
	dbPath = path
	return dbConn, dbPath, nil
}

// WebhookLog represents a single received SMS webhook entry
type WebhookLog struct {
	ID              int64   `json:"id"`
	ReceivedAt      string  `json:"received_at"`
	Sender          string  `json:"sender"`
	Bank            string  `json:"bank"`
	RawPayload      string  `json:"raw_payload"`
	SMSText         string  `json:"sms_text"`
	ExtractedAmount float64 `json:"extracted_amount"`
	BankRef         string  `json:"bank_ref"`
	Matched         bool    `json:"matched"`
	OrderID         *int64  `json:"order_id"`
	UserID          *int64  `json:"user_id"`
	Status          string  `json:"status"` // success, unmatched, test, no_amount, empty, error, ready
	Message         string  `json:"message"`
}

func RecordWebhookLog(log WebhookLog) error {
	db, _, err := GetDB()
	if err != nil {
		return err
	}
	matchedInt := 0
	if log.Matched {
		matchedInt = 1
	}
	_, err = db.Exec(`
		INSERT INTO webhook_logs (
			sender, bank, raw_payload, sms_text, extracted_amount, bank_ref, matched, order_id, user_id, status, message
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		log.Sender, log.Bank, log.RawPayload, log.SMSText, log.ExtractedAmount, log.BankRef, matchedInt, log.OrderID, log.UserID, log.Status, log.Message,
	)
	return err
}

func GetWebhookLogs(limit int) ([]WebhookLog, error) {
	db, _, err := GetDB()
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := db.Query(`
		SELECT id, datetime(received_at, 'localtime') as rec_time, sender, bank, raw_payload, sms_text, extracted_amount, bank_ref, matched, order_id, user_id, status, message
		FROM webhook_logs
		ORDER BY id DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []WebhookLog
	for rows.Next() {
		var item WebhookLog
		var matchedInt int
		if err := rows.Scan(
			&item.ID, &item.ReceivedAt, &item.Sender, &item.Bank, &item.RawPayload,
			&item.SMSText, &item.ExtractedAmount, &item.BankRef, &matchedInt,
			&item.OrderID, &item.UserID, &item.Status, &item.Message,
		); err == nil {
			item.Matched = matchedInt == 1
			list = append(list, item)
		}
	}
	if list == nil {
		list = []WebhookLog{}
	}
	return list, nil
}

func ClearWebhookLogs() error {
	db, _, err := GetDB()
	if err != nil {
		return err
	}
	_, err = db.Exec(`DELETE FROM webhook_logs`)
	return err
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
	var (
		uUsername      sql.NullString
		uFirstName     sql.NullString
		uWalletBalance sql.NullFloat64
		uPanelUsername sql.NullString
		uSubURL        sql.NullString
		uServiceStatus sql.NullString
		uTotalSpent    sql.NullFloat64
		uHasUsedTest   sql.NullInt64
		uCreatedAt     sql.NullString
	)

	err = db.QueryRow(`
		SELECT telegram_id, username, first_name, wallet_balance, panel_username, sub_url, service_status, total_spent, has_used_test, created_at 
		FROM users WHERE telegram_id = ?`, tgID).Scan(
		&u.TelegramID, &uUsername, &uFirstName, &uWalletBalance, &uPanelUsername, &uSubURL, &uServiceStatus, &uTotalSpent, &uHasUsedTest, &uCreatedAt,
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
			HasUsedTest:   false,
			CreatedAt:     now,
		}, nil
	}
	if err != nil {
		return nil, err
	}

	u.Username = uUsername.String
	u.FirstName = uFirstName.String
	u.WalletBalance = uWalletBalance.Float64
	u.PanelUsername = uPanelUsername.String
	u.SubURL = uSubURL.String
	u.ServiceStatus = uServiceStatus.String
	if u.ServiceStatus == "" {
		u.ServiceStatus = "none"
	}
	u.TotalSpent = uTotalSpent.Float64
	u.HasUsedTest = uHasUsedTest.Int64 == 1
	u.CreatedAt = parseTimeStr(uCreatedAt.String)

	// Update username/firstName if changed
	if u.Username != username || u.FirstName != firstName {
		_, _ = db.Exec(`UPDATE users SET username = ?, first_name = ? WHERE telegram_id = ?`, username, firstName, tgID)
		u.Username = username
		u.FirstName = firstName
	}
	return &u, nil
}

func MarkUserUsedTest(tgID int64) error {
	db, _, err := GetDB()
	if err != nil {
		return err
	}
	_, err = db.Exec(`UPDATE users SET has_used_test = 1 WHERE telegram_id = ?`, tgID)
	return err
}

func ActivateUserPanel(tgID int64, username, subURL string) error {
	db, _, err := GetDB()
	if err != nil {
		return err
	}
	_, err = db.Exec(`
		UPDATE users 
		SET panel_username = ?, sub_url = ?, service_status = 'active'
		WHERE telegram_id = ?`, username, subURL, tgID)
	return err
}

func RedeemGiftCode(userID int64, rawCode string) (float64, error) {
	code := strings.ToUpper(strings.TrimSpace(rawCode))
	if code == "" {
		return 0, fmt.Errorf("کد هدیه وارد نشده است")
	}

	db, _, err := GetDB()
	if err != nil {
		return 0, err
	}

	var alreadyCount int
	_ = db.QueryRow(`SELECT COUNT(*) FROM gift_code_redemptions WHERE user_id = ? AND UPPER(code) = ?`, userID, code).Scan(&alreadyCount)
	if alreadyCount > 0 {
		return 0, fmt.Errorf("شما قبلاً از این کد هدیه استفاده کرده‌اید")
	}

	var (
		id        int64
		amount    float64
		maxUses   int
		usedCount int
	)
	err = db.QueryRow(`SELECT id, amount, max_uses, used_count FROM gift_codes WHERE UPPER(code) = ?`, code).Scan(&id, &amount, &maxUses, &usedCount)
	if err == sql.ErrNoRows {
		return 0, fmt.Errorf("کد هدیه نامعتبر است یا وجود ندارد")
	}
	if err != nil {
		return 0, err
	}

	if maxUses > 0 && usedCount >= maxUses {
		return 0, fmt.Errorf("ظرفیت استفاده از این کد هدیه به پایان رسیده است")
	}

	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE gift_codes SET used_count = used_count + 1 WHERE id = ?`, id); err != nil {
		return 0, err
	}

	if _, err := tx.Exec(`INSERT INTO gift_code_redemptions (user_id, code, amount) VALUES (?, ?, ?)`, userID, code, amount); err != nil {
		return 0, err
	}

	if _, err := tx.Exec(`UPDATE users SET wallet_balance = wallet_balance + ? WHERE telegram_id = ?`, amount, userID); err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return amount, nil
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
