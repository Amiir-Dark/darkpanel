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
	PanelPassword string    `json:"panel_password"`
	SubURL        string    `json:"sub_url"`
	ServiceStatus string    `json:"service_status"`
	TotalSpent     float64   `json:"total_spent"`
	HasUsedTest    bool      `json:"has_used_test"`
	TestUsageCount int       `json:"test_usage_count"`
	CreatedAt      time.Time `json:"created_at"`
}

type UserPanel struct {
	ID            int64     `json:"id"`
	UserID        int64     `json:"user_id"`
	PanelUsername string    `json:"panel_username"`
	PanelPassword string    `json:"panel_password"`
	PanelURL      string    `json:"panel_url"`
	PanelType     string    `json:"panel_type"` // payg, test
	Status        string    `json:"status"`     // active, disabled, deleted
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

	CREATE TABLE IF NOT EXISTS user_panels (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		panel_username TEXT NOT NULL,
		panel_password TEXT DEFAULT '',
		panel_url TEXT DEFAULT '',
		panel_type TEXT DEFAULT 'payg',
		status TEXT DEFAULT 'active',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(user_id, panel_username)
	);

	CREATE INDEX IF NOT EXISTS idx_user_panels_user ON user_panels(user_id);
	CREATE INDEX IF NOT EXISTS idx_user_panels_username ON user_panels(panel_username);
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
		"ALTER TABLE users ADD COLUMN panel_password TEXT DEFAULT '';",
		"ALTER TABLE users ADD COLUMN sub_url TEXT DEFAULT '';",
		"ALTER TABLE users ADD COLUMN service_status TEXT DEFAULT 'none';",
		"ALTER TABLE users ADD COLUMN total_spent REAL DEFAULT 0;",
		"ALTER TABLE users ADD COLUMN has_used_test INTEGER DEFAULT 0;",
		"ALTER TABLE users ADD COLUMN test_usage_count INTEGER DEFAULT 0;",
		"ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;",
		"ALTER TABLE orders ADD COLUMN bank_ref TEXT DEFAULT '';",
		"ALTER TABLE orders ADD COLUMN code TEXT DEFAULT '';",
		"ALTER TABLE webhook_logs ADD COLUMN order_id INTEGER NULL;",
		"ALTER TABLE webhook_logs ADD COLUMN user_id INTEGER NULL;",
		"ALTER TABLE webhook_logs ADD COLUMN status TEXT DEFAULT 'received';",
		"ALTER TABLE webhook_logs ADD COLUMN message TEXT DEFAULT '';",
		"ALTER TABLE usage_tracking ADD COLUMN panel_username TEXT DEFAULT '';",
	}
	for _, m := range colMigrations {
		_, _ = conn.Exec(m)
	}

	// Populate user_panels from existing users table if any panel is not already recorded
	_, _ = conn.Exec(`
		INSERT OR IGNORE INTO user_panels (user_id, panel_username, panel_password, panel_url, panel_type, status)
		SELECT telegram_id, panel_username, panel_password, sub_url,
		       CASE WHEN has_used_test = 1 AND panel_username LIKE 'test_%' THEN 'test' ELSE 'payg' END,
		       CASE WHEN service_status = 'disabled' THEN 'disabled' ELSE 'active' END
		FROM users
		WHERE panel_username != '' AND panel_username IS NOT NULL;
	`)

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
		uPanelPassword sql.NullString
		uSubURL        sql.NullString
		uServiceStatus sql.NullString
		uTotalSpent    sql.NullFloat64
		uHasUsedTest   sql.NullInt64
		uTestCount     sql.NullInt64
		uCreatedAt     sql.NullString
	)

	err = db.QueryRow(`
		SELECT telegram_id, username, first_name, wallet_balance, panel_username, panel_password, sub_url, service_status, total_spent, has_used_test, test_usage_count, created_at 
		FROM users WHERE telegram_id = ?`, tgID).Scan(
		&u.TelegramID, &uUsername, &uFirstName, &uWalletBalance, &uPanelUsername, &uPanelPassword, &uSubURL, &uServiceStatus, &uTotalSpent, &uHasUsedTest, &uTestCount, &uCreatedAt,
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
	u.PanelPassword = uPanelPassword.String
	u.SubURL = uSubURL.String
	u.ServiceStatus = uServiceStatus.String
	if u.ServiceStatus == "" {
		u.ServiceStatus = "none"
	}
	u.TotalSpent = uTotalSpent.Float64
	u.HasUsedTest = uHasUsedTest.Int64 == 1
	u.TestUsageCount = int(uTestCount.Int64)
	if u.TestUsageCount == 0 && u.HasUsedTest {
		u.TestUsageCount = 1
	}
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
	_, err = db.Exec(`UPDATE users SET has_used_test = 1, test_usage_count = COALESCE(test_usage_count, 0) + 1 WHERE telegram_id = ?`, tgID)
	return err
}

func ActivateUserPanel(tgID int64, username, password, subURL string, panelType ...string) error {
	pType := "payg"
	if len(panelType) > 0 && strings.TrimSpace(panelType[0]) != "" {
		pType = strings.TrimSpace(panelType[0])
	}
	db, _, err := GetDB()
	if err != nil {
		return err
	}
	// 1. Update users table fallback
	_, _ = db.Exec(`
		UPDATE users 
		SET panel_username = ?, panel_password = ?, sub_url = ?, service_status = 'active'
		WHERE telegram_id = ?`, username, password, subURL, tgID)

	// 2. Insert or update user_panels table
	_, err = db.Exec(`
		INSERT INTO user_panels (user_id, panel_username, panel_password, panel_url, panel_type, status)
		VALUES (?, ?, ?, ?, ?, 'active')
		ON CONFLICT(user_id, panel_username) DO UPDATE SET
			panel_password = excluded.panel_password,
			panel_url = excluded.panel_url,
			panel_type = excluded.panel_type,
			status = 'active'
	`, tgID, username, password, subURL, pType)

	return err
}

// GetUserPanels returns all non-deleted panels for a telegram user
func GetUserPanels(userID int64) ([]UserPanel, error) {
	db, _, err := GetDB()
	if err != nil {
		return nil, err
	}

	rows, err := db.Query(`
		SELECT id, user_id, panel_username, panel_password, panel_url, panel_type, status, created_at
		FROM user_panels
		WHERE user_id = ? AND status != 'deleted'
		ORDER BY id ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var panels []UserPanel
	for rows.Next() {
		var p UserPanel
		var uPass, uURL, pType, pStatus sql.NullString
		var crAt sql.NullTime
		if err := rows.Scan(&p.ID, &p.UserID, &p.PanelUsername, &uPass, &uURL, &pType, &pStatus, &crAt); err == nil {
			p.PanelPassword = uPass.String
			p.PanelURL = uURL.String
			p.PanelType = pType.String
			p.Status = pStatus.String
			if crAt.Valid {
				p.CreatedAt = crAt.Time
			}
			panels = append(panels, p)
		}
	}

	// If empty, check if users table has legacy panel and auto-migrate it
	if len(panels) == 0 {
		var uPanelUser, uPanelPass, uSubURL, uStatus sql.NullString
		var hasTest sql.NullInt64
		err := db.QueryRow(`
			SELECT panel_username, panel_password, sub_url, service_status, has_used_test
			FROM users WHERE telegram_id = ?
		`, userID).Scan(&uPanelUser, &uPanelPass, &uSubURL, &uStatus, &hasTest)
		if err == nil && uPanelUser.Valid && strings.TrimSpace(uPanelUser.String) != "" {
			pType := "payg"
			if hasTest.Int64 == 1 && strings.HasPrefix(uPanelUser.String, "test_") {
				pType = "test"
			}
			_ = ActivateUserPanel(userID, uPanelUser.String, uPanelPass.String, uSubURL.String, pType)
			if uStatus.String == "disabled" {
				_, _ = db.Exec(`UPDATE user_panels SET status = 'disabled' WHERE user_id = ? AND panel_username = ?`, userID, uPanelUser.String)
			}
			return GetUserPanels(userID)
		}
	}

	return panels, nil
}

// GetUserPanelByID returns a single panel owned by the telegram user
func GetUserPanelByID(userID int64, panelID int64) (*UserPanel, error) {
	db, _, err := GetDB()
	if err != nil {
		return nil, err
	}

	var p UserPanel
	var uPass, uURL, pType, pStatus sql.NullString
	var crAt sql.NullTime
	err = db.QueryRow(`
		SELECT id, user_id, panel_username, panel_password, panel_url, panel_type, status, created_at
		FROM user_panels
		WHERE id = ? AND user_id = ? AND status != 'deleted'
	`, panelID, userID).Scan(&p.ID, &p.UserID, &p.PanelUsername, &uPass, &uURL, &pType, &pStatus, &crAt)
	if err != nil {
		return nil, err
	}
	p.PanelPassword = uPass.String
	p.PanelURL = uURL.String
	p.PanelType = pType.String
	p.Status = pStatus.String
	if crAt.Valid {
		p.CreatedAt = crAt.Time
	}
	return &p, nil
}

// GetUserActivePanelCount returns the count of active (non-deleted) panels for this user
func GetUserActivePanelCount(userID int64) int {
	db, _, err := GetDB()
	if err != nil {
		return 0
	}
	var count int
	_ = db.QueryRow(`SELECT COUNT(*) FROM user_panels WHERE user_id = ? AND status != 'deleted'`, userID).Scan(&count)
	return count
}

// GetMaxPanelsPerUser returns the configured max panels per user limit (0 = unlimited)
func GetMaxPanelsPerUser() int {
	return GetSettingInt("max_panels_per_user", 1)
}

// UpdateUserPanelPassword updates the plain password in SQLite
func UpdateUserPanelPassword(userID int64, panelID int64, newPass string) error {
	db, _, err := GetDB()
	if err != nil {
		return err
	}
	var panelUsername string
	err = db.QueryRow(`SELECT panel_username FROM user_panels WHERE id = ? AND user_id = ?`, panelID, userID).Scan(&panelUsername)
	if err != nil {
		return err
	}
	_, err = db.Exec(`UPDATE user_panels SET panel_password = ? WHERE id = ? AND user_id = ?`, newPass, panelID, userID)
	if err != nil {
		return err
	}
	_, _ = db.Exec(`UPDATE users SET panel_password = ? WHERE telegram_id = ? AND LOWER(panel_username) = LOWER(?)`, newPass, userID, panelUsername)
	return nil
}

// DeleteUserPanel marks a panel as deleted in SQLite and updates users table primary fallback
func DeleteUserPanel(userID int64, panelID int64) (*UserPanel, error) {
	p, err := GetUserPanelByID(userID, panelID)
	if err != nil {
		return nil, err
	}
	db, _, err := GetDB()
	if err != nil {
		return nil, err
	}

	_, err = db.Exec(`UPDATE user_panels SET status = 'deleted' WHERE id = ? AND user_id = ?`, panelID, userID)
	if err != nil {
		return nil, err
	}

	// Re-evaluate users table primary panel
	var nextUser, nextPass, nextURL, nextStatus string
	err = db.QueryRow(`
		SELECT panel_username, panel_password, panel_url, status
		FROM user_panels
		WHERE user_id = ? AND status != 'deleted'
		ORDER BY id DESC LIMIT 1
	`, userID).Scan(&nextUser, &nextPass, &nextURL, &nextStatus)
	if err == nil && nextUser != "" {
		st := "active"
		if nextStatus == "disabled" {
			st = "disabled"
		}
		_, _ = db.Exec(`
			UPDATE users
			SET panel_username = ?, panel_password = ?, sub_url = ?, service_status = ?
			WHERE telegram_id = ?
		`, nextUser, nextPass, nextURL, st, userID)
	} else {
		_, _ = db.Exec(`
			UPDATE users
			SET panel_username = '', panel_password = '', sub_url = '', service_status = 'none'
			WHERE telegram_id = ?
		`, userID)
	}

	return p, nil
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

	ReactivateAdminIfPaid(userID)

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
