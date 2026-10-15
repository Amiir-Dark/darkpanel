package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rebeccapanel/rebecca/internal/app/salesbot"
	_ "modernc.org/sqlite"
)

var (
	botDBOnce sync.Once
	botDB     *sql.DB
	botDBPath string
	botDBMu   sync.Mutex
)

// resolveBotDBPath locates the SQLite database for the sales bot
func resolveBotDBPath() string {
	if p := strings.TrimSpace(os.Getenv("BOT_DATABASE_PATH")); p != "" {
		return p
	}

	candidates := []string{
		"/opt/darkpanel/bot/bot.db",
		"/opt/rebecca/bot/bot.db",
		"bot/bot.db",
		"../bot/bot.db",
		"bot.db",
	}

	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && !fi.IsDir() {
			return c
		}
	}

	// If not found, use standard default based on environment
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

// getBotDB returns a singleton sql.DB connection to bot.db with WAL enabled
func getBotDB() (*sql.DB, string, error) {
	botDBMu.Lock()
	defer botDBMu.Unlock()

	if botDB != nil {
		if err := botDB.Ping(); err == nil {
			return botDB, botDBPath, nil
		}
		_ = botDB.Close()
		botDB = nil
	}

	path := resolveBotDBPath()
	conn, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, path, fmt.Errorf("failed to open bot sqlite: %w", err)
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
		return nil, path, fmt.Errorf("failed to init bot schema: %w", err)
	}

	botDB = conn
	botDBPath = path
	return botDB, botDBPath, nil
}

func (s *Server) registerSalesBotRoutes(r chi.Router) {
	r.HandleFunc("/sales-bot/overview", s.requireAdmin(s.handleSalesBotOverview))
	r.HandleFunc("/sales-bot/service/status", s.requireAdmin(s.handleSalesBotServiceStatus))
	r.HandleFunc("/sales-bot/service/start", s.requireAdmin(s.handleSalesBotServiceStart))
	r.HandleFunc("/sales-bot/service/stop", s.requireAdmin(s.handleSalesBotServiceStop))
	r.HandleFunc("/sales-bot/service/restart", s.requireAdmin(s.handleSalesBotServiceRestart))
	r.HandleFunc("/sales-bot/settings", s.requireAdmin(s.handleSalesBotSettings))
	r.HandleFunc("/sales-bot/orders/*", s.requireAdmin(s.handleSalesBotOrderAction))
	r.HandleFunc("/sales-bot/orders", s.requireAdmin(s.handleSalesBotOrders))
	r.HandleFunc("/sales-bot/receipts/*", s.requireAdmin(s.handleSalesBotReceiptAction))
	r.HandleFunc("/sales-bot/receipts", s.requireAdmin(s.handleSalesBotReceipts))
	r.HandleFunc("/sales-bot/users/*", s.requireAdmin(s.handleSalesBotUserAction))
	r.HandleFunc("/sales-bot/users", s.requireAdmin(s.handleSalesBotUsers))
	r.HandleFunc("/sales-bot/webhook/test", s.requireAdmin(s.handleSalesBotWebhookTest))
	r.HandleFunc("/sales-bot/webhook/forapp", s.handlePublicForAppWebhook)
}

// -------------------------------------------------------------
// 0. Service Lifecycle (Start / Stop / Restart)
// -------------------------------------------------------------

func (s *Server) handleSalesBotServiceStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(w, http.StatusOK, salesbot.GetService().Status())
}

func (s *Server) handleSalesBotServiceStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := salesbot.GetService().Start(r.Context()); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = salesbot.SetSetting("sales_bot_enabled", "true")
	writeJSON(w, http.StatusOK, salesbot.GetService().Status())
}

func (s *Server) handleSalesBotServiceStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	_ = salesbot.GetService().Stop()
	_ = salesbot.SetSetting("sales_bot_enabled", "false")
	writeJSON(w, http.StatusOK, salesbot.GetService().Status())
}

func (s *Server) handleSalesBotServiceRestart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := salesbot.GetService().Restart(r.Context()); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = salesbot.SetSetting("sales_bot_enabled", "true")
	writeJSON(w, http.StatusOK, salesbot.GetService().Status())
}

// -------------------------------------------------------------
// 1. Overview
// -------------------------------------------------------------

func (s *Server) handleSalesBotOverview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	db, dbPath, err := getBotDB()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	type OverviewStats struct {
		Service              salesbot.ServiceStatus `json:"service"`
		DBPath               string                 `json:"db_path"`
		TotalUsers           int64                  `json:"total_users"`
		ActiveServices       int64                  `json:"active_services"`
		TotalWalletsBalance  float64                `json:"total_wallets_balance"`
		TotalApprovedRevenue float64                `json:"total_approved_revenue"`
		OrdersTodayCount     int64                  `json:"orders_today_count"`
		OrdersTodayPaid      float64                `json:"orders_today_paid"`
		OrdersPendingCount   int64                  `json:"orders_pending_count"`
		OrdersExpiredCount   int64                  `json:"orders_expired_count"`
		ReceiptsPendingCount int64                  `json:"receipts_pending_count"`
		TotalTrafficGB       float64                `json:"total_traffic_gb"`
		WebhookPort          int                    `json:"webhook_port"`
		WebhookPath          string                 `json:"webhook_path"`
		WebhookSecret        string                 `json:"webhook_secret"`
	}

	var stats OverviewStats
	stats.Service = salesbot.GetService().Status()
	stats.DBPath = dbPath

	_ = db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&stats.TotalUsers)
	_ = db.QueryRow(`SELECT COUNT(*) FROM users WHERE service_status = 'active'`).Scan(&stats.ActiveServices)
	_ = db.QueryRow(`SELECT COALESCE(SUM(wallet_balance), 0) FROM users`).Scan(&stats.TotalWalletsBalance)

	// Revenue: approved receipts + paid orders
	var receiptsApproved, ordersPaid float64
	_ = db.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM receipts WHERE status = 'approved'`).Scan(&receiptsApproved)
	_ = db.QueryRow(`SELECT COALESCE(SUM(amount_exact), 0) FROM orders WHERE status = 'paid'`).Scan(&ordersPaid)
	stats.TotalApprovedRevenue = receiptsApproved + ordersPaid

	// Orders stats
	_ = db.QueryRow(`SELECT COUNT(*) FROM orders WHERE date(created_at) = date('now')`).Scan(&stats.OrdersTodayCount)
	_ = db.QueryRow(`SELECT COALESCE(SUM(amount_exact), 0) FROM orders WHERE status = 'paid' AND date(created_at) = date('now')`).Scan(&stats.OrdersTodayPaid)
	_ = db.QueryRow(`SELECT COUNT(*) FROM orders WHERE status = 'pending' AND expires_at > datetime('now')`).Scan(&stats.OrdersPendingCount)
	_ = db.QueryRow(`SELECT COUNT(*) FROM orders WHERE status = 'expired' OR (status = 'pending' AND expires_at <= datetime('now'))`).Scan(&stats.OrdersExpiredCount)

	// Receipts stats
	_ = db.QueryRow(`SELECT COUNT(*) FROM receipts WHERE status = 'pending'`).Scan(&stats.ReceiptsPendingCount)

	// Billed traffic
	var totalBilledBytes int64
	_ = db.QueryRow(`SELECT COALESCE(SUM(total_billed_bytes), 0) FROM usage_tracking`).Scan(&totalBilledBytes)
	stats.TotalTrafficGB = float64(totalBilledBytes) / (1024 * 1024 * 1024)

	// Webhook config from settings or defaults
	stats.WebhookPort = 8085
	stats.WebhookPath = "/webhook/forapp"

	var portStr, secretStr string
	_ = db.QueryRow(`SELECT value FROM settings WHERE key = 'forapp_port'`).Scan(&portStr)
	if p, err := strconv.Atoi(portStr); err == nil && p > 0 {
		stats.WebhookPort = p
	}
	_ = db.QueryRow(`SELECT value FROM settings WHERE key = 'forapp_secret'`).Scan(&secretStr)
	stats.WebhookSecret = secretStr

	writeJSON(w, http.StatusOK, stats)
}

// -------------------------------------------------------------
// 2. Settings
// -------------------------------------------------------------

func (s *Server) handleSalesBotSettings(w http.ResponseWriter, r *http.Request) {
	db, _, err := getBotDB()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query(`SELECT key, value FROM settings`)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		settings := make(map[string]string)
		for rows.Next() {
			var k, v string
			if err := rows.Scan(&k, &v); err == nil {
				settings[k] = v
			}
		}

		// Provide defaults if not present
		defaults := map[string]string{
			"price_per_gb":        "5000",
			"min_balance_to_start": "5000",
			"card_number":         "",
			"card_holder":         "",
			"bank_name":           "",
			"shaba_number":        "",
			"forapp_port":         "8085",
			"forapp_path":         "/webhook/forapp",
			"forapp_secret":       "",
			"tether_wallet":       "",
			"ton_wallet":          "",
			"support_username":    "@AdminSupport",
			"channel_username":    "",
			"bot_token":           "",
			"admin_ids":           "",
			"sync_interval":       "120",
		}
		for dk, dv := range defaults {
			if _, exists := settings[dk]; !exists {
				settings[dk] = dv
			}
		}

		writeJSON(w, http.StatusOK, settings)
		return

	case http.MethodPost, http.MethodPut:
		var payload map[string]string
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request json: "+err.Error())
			return
		}

		tx, err := db.Begin()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer tx.Rollback()

		stmt, err := tx.Prepare(`
			INSERT INTO settings (key, value) VALUES (?, ?)
			ON CONFLICT(key) DO UPDATE SET value = excluded.value
		`)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer stmt.Close()

		for k, v := range payload {
			k = strings.TrimSpace(k)
			if k == "" {
				continue
			}
			if _, err := stmt.Exec(k, strings.TrimSpace(v)); err != nil {
				writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
		}

		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "تنظیمات با موفقیت ذخیره شد"})
		return

	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

// -------------------------------------------------------------
// 3. Orders (5-Minute randomized tail orders)
// -------------------------------------------------------------

type BotOrderResponse struct {
	ID          int64   `json:"id"`
	UserID      int64   `json:"user_id"`
	Username    string  `json:"username"`
	FirstName   string  `json:"first_name"`
	AmountBase  float64 `json:"amount_base"`
	AmountExact float64 `json:"amount_exact"`
	Code        string  `json:"code"`
	Status      string  `json:"status"`
	BankRef     string  `json:"bank_ref"`
	CreatedAt   string  `json:"created_at"`
	ExpiresAt   string  `json:"expires_at"`
	IsExpired   bool    `json:"is_expired"`
	SecondsLeft int64   `json:"seconds_left"`
}

func (s *Server) handleSalesBotOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	db, _, err := getBotDB()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	statusFilter := strings.TrimSpace(r.URL.Query().Get("status"))
	limit := 50
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 500 {
			limit = l
		}
	}

	var query string
	var args []any
	if statusFilter != "" && statusFilter != "all" {
		query = `
			SELECT o.id, o.user_id, COALESCE(u.username, ''), COALESCE(u.first_name, ''),
			       o.amount_base, o.amount_exact, o.code, o.status, o.bank_ref,
			       o.created_at, o.expires_at
			FROM orders o
			LEFT JOIN users u ON o.user_id = u.telegram_id
			WHERE o.status = ?
			ORDER BY o.id DESC LIMIT ?
		`
		args = append(args, statusFilter, limit)
	} else {
		query = `
			SELECT o.id, o.user_id, COALESCE(u.username, ''), COALESCE(u.first_name, ''),
			       o.amount_base, o.amount_exact, o.code, o.status, o.bank_ref,
			       o.created_at, o.expires_at
			FROM orders o
			LEFT JOIN users u ON o.user_id = u.telegram_id
			ORDER BY o.id DESC LIMIT ?
		`
		args = append(args, limit)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	now := time.Now()
	var orders []BotOrderResponse
	for rows.Next() {
		var o BotOrderResponse
		var createdAtStr, expiresAtStr string
		err := rows.Scan(
			&o.ID, &o.UserID, &o.Username, &o.FirstName,
			&o.AmountBase, &o.AmountExact, &o.Code, &o.Status, &o.BankRef,
			&createdAtStr, &expiresAtStr,
		)
		if err != nil {
			continue
		}
		o.CreatedAt = createdAtStr
		o.ExpiresAt = expiresAtStr

		expTime := parseSQLiteTime(expiresAtStr)
		if !expTime.IsZero() {
			diff := expTime.Sub(now).Seconds()
			if diff > 0 {
				o.SecondsLeft = int64(diff)
				o.IsExpired = false
			} else {
				o.SecondsLeft = 0
				o.IsExpired = true
				if o.Status == "pending" {
					o.Status = "expired"
				}
			}
		}

		orders = append(orders, o)
	}

	if orders == nil {
		orders = []BotOrderResponse{}
	}

	writeJSON(w, http.StatusOK, orders)
}

func (s *Server) handleSalesBotOrderAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/sales-bot/orders/"), "/")
	parts := strings.Split(path, "/")
	if len(parts) != 2 {
		writeError(w, http.StatusBadRequest, "invalid url pattern; expected /api/sales-bot/orders/{id}/{action}")
		return
	}

	orderID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid order id")
		return
	}
	action := strings.ToLower(parts[1])

	db, _, err := getBotDB()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	switch action {
	case "cancel":
		_, err := db.Exec(`UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'`, orderID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "سفارش با موفقیت لغو شد"})

	case "mark-paid":
		tx, err := db.Begin()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer tx.Rollback()

		var userID int64
		var amountExact float64
		var status string
		err = tx.QueryRow(`SELECT user_id, amount_exact, status FROM orders WHERE id = ?`, orderID).Scan(&userID, &amountExact, &status)
		if err != nil {
			writeError(w, http.StatusNotFound, "سفارش یافت نشد")
			return
		}
		if status == "paid" {
			writeError(w, http.StatusBadRequest, "این سفارش قبلا پرداخت شده است")
			return
		}

		_, err = tx.Exec(`UPDATE orders SET status = 'paid', bank_ref = 'manual_panel_admin' WHERE id = ?`, orderID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		_, err = tx.Exec(`
			UPDATE users 
			SET wallet_balance = wallet_balance + ?, total_spent = total_spent + ?
			WHERE telegram_id = ?
		`, amountExact, amountExact, userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "سفارش پرداخت و کیف پول کاربر شارژ شد"})

	default:
		writeError(w, http.StatusBadRequest, "عملیات نامعتبر است: "+action)
	}
}

// -------------------------------------------------------------
// 4. Receipts (Card-to-Card Manual Receipts)
// -------------------------------------------------------------

type BotReceiptResponse struct {
	ID        int64   `json:"id"`
	UserID    int64   `json:"user_id"`
	Username  string  `json:"username"`
	FirstName string  `json:"first_name"`
	Amount    float64 `json:"amount"`
	FileID    string  `json:"file_id"`
	Status    string  `json:"status"`
	CreatedAt string  `json:"created_at"`
}

func (s *Server) handleSalesBotReceipts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	db, _, err := getBotDB()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	statusFilter := strings.TrimSpace(r.URL.Query().Get("status"))
	limit := 50
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 500 {
			limit = l
		}
	}

	var query string
	var args []any
	if statusFilter != "" && statusFilter != "all" {
		query = `
			SELECT r.id, r.user_id, COALESCE(u.username, ''), COALESCE(u.first_name, ''),
			       r.amount, r.file_id, r.status, r.created_at
			FROM receipts r
			LEFT JOIN users u ON r.user_id = u.telegram_id
			WHERE r.status = ?
			ORDER BY r.id DESC LIMIT ?
		`
		args = append(args, statusFilter, limit)
	} else {
		query = `
			SELECT r.id, r.user_id, COALESCE(u.username, ''), COALESCE(u.first_name, ''),
			       r.amount, r.file_id, r.status, r.created_at
			FROM receipts r
			LEFT JOIN users u ON r.user_id = u.telegram_id
			ORDER BY r.id DESC LIMIT ?
		`
		args = append(args, limit)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var receipts []BotReceiptResponse
	for rows.Next() {
		var rec BotReceiptResponse
		if err := rows.Scan(&rec.ID, &rec.UserID, &rec.Username, &rec.FirstName, &rec.Amount, &rec.FileID, &rec.Status, &rec.CreatedAt); err == nil {
			receipts = append(receipts, rec)
		}
	}

	if receipts == nil {
		receipts = []BotReceiptResponse{}
	}

	writeJSON(w, http.StatusOK, receipts)
}

func (s *Server) handleSalesBotReceiptAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/sales-bot/receipts/"), "/")
	parts := strings.Split(path, "/")
	if len(parts) != 2 {
		writeError(w, http.StatusBadRequest, "invalid url pattern; expected /api/sales-bot/receipts/{id}/{action}")
		return
	}

	receiptID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid receipt id")
		return
	}
	action := strings.ToLower(parts[1])

	db, _, err := getBotDB()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	switch action {
	case "approve":
		tx, err := db.Begin()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer tx.Rollback()

		var userID int64
		var amount float64
		var status string
		err = tx.QueryRow(`SELECT user_id, amount, status FROM receipts WHERE id = ?`, receiptID).Scan(&userID, &amount, &status)
		if err != nil {
			writeError(w, http.StatusNotFound, "فیش یافت نشد")
			return
		}
		if status == "approved" {
			writeError(w, http.StatusBadRequest, "این فیش قبلا تایید شده است")
			return
		}

		_, err = tx.Exec(`UPDATE receipts SET status = 'approved' WHERE id = ?`, receiptID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		_, err = tx.Exec(`
			UPDATE users 
			SET wallet_balance = wallet_balance + ?, total_spent = total_spent + ?
			WHERE telegram_id = ?
		`, amount, amount, userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "فیش با موفقیت تایید و کیف پول شارژ شد"})

	case "reject":
		_, err := db.Exec(`UPDATE receipts SET status = 'rejected' WHERE id = ?`, receiptID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "فیش رد شد"})

	default:
		writeError(w, http.StatusBadRequest, "عملیات نامعتبر است: "+action)
	}
}

// -------------------------------------------------------------
// 5. Users / Customers
// -------------------------------------------------------------

type BotUserResponse struct {
	TelegramID    int64   `json:"telegram_id"`
	Username      string  `json:"username"`
	FirstName     string  `json:"first_name"`
	WalletBalance float64 `json:"wallet_balance"`
	PanelUsername string  `json:"panel_username"`
	SubURL        string  `json:"sub_url"`
	ServiceStatus string  `json:"service_status"`
	TotalSpent    float64 `json:"total_spent"`
	CreatedAt     string  `json:"created_at"`
}

func (s *Server) handleSalesBotUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	db, _, err := getBotDB()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	search := strings.TrimSpace(r.URL.Query().Get("search"))
	statusFilter := strings.TrimSpace(r.URL.Query().Get("status"))
	limit := 100
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 1000 {
			limit = l
		}
	}

	query := `
		SELECT telegram_id, username, first_name, wallet_balance,
		       panel_username, sub_url, service_status, total_spent, created_at
		FROM users
		WHERE 1=1
	`
	var args []any

	if statusFilter != "" && statusFilter != "all" {
		query += ` AND service_status = ?`
		args = append(args, statusFilter)
	}

	if search != "" {
		query += ` AND (username LIKE ? OR first_name LIKE ? OR panel_username LIKE ? OR CAST(telegram_id AS TEXT) LIKE ?)`
		like := "%" + search + "%"
		args = append(args, like, like, like, like)
	}

	query += ` ORDER BY telegram_id DESC LIMIT ?`
	args = append(args, limit)

	rows, err := db.Query(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var users []BotUserResponse
	for rows.Next() {
		var u BotUserResponse
		if err := rows.Scan(
			&u.TelegramID, &u.Username, &u.FirstName, &u.WalletBalance,
			&u.PanelUsername, &u.SubURL, &u.ServiceStatus, &u.TotalSpent, &u.CreatedAt,
		); err == nil {
			users = append(users, u)
		}
	}

	if users == nil {
		users = []BotUserResponse{}
	}

	writeJSON(w, http.StatusOK, users)
}

func (s *Server) handleSalesBotUserAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/sales-bot/users/"), "/")
	parts := strings.Split(path, "/")
	if len(parts) != 2 || parts[1] != "wallet" {
		writeError(w, http.StatusBadRequest, "invalid url pattern; expected /api/sales-bot/users/{id}/wallet")
		return
	}

	telegramID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid telegram id")
		return
	}

	var payload struct {
		Operation string  `json:"operation"` // add, subtract, set
		Amount    float64 `json:"amount"`
		Reason    string  `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json: "+err.Error())
		return
	}

	db, _, err := getBotDB()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	switch strings.ToLower(payload.Operation) {
	case "add":
		if payload.Amount <= 0 {
			writeError(w, http.StatusBadRequest, "مبلغ باید بیشتر از صفر باشد")
			return
		}
		_, err := db.Exec(`UPDATE users SET wallet_balance = wallet_balance + ? WHERE telegram_id = ?`, payload.Amount, telegramID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	case "subtract":
		if payload.Amount <= 0 {
			writeError(w, http.StatusBadRequest, "مبلغ باید بیشتر از صفر باشد")
			return
		}
		_, err := db.Exec(`UPDATE users SET wallet_balance = MAX(0, wallet_balance - ?) WHERE telegram_id = ?`, payload.Amount, telegramID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	case "set":
		if payload.Amount < 0 {
			writeError(w, http.StatusBadRequest, "مبلغ نمی‌تواند منفی باشد")
			return
		}
		_, err := db.Exec(`UPDATE users SET wallet_balance = ? WHERE telegram_id = ?`, payload.Amount, telegramID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	default:
		writeError(w, http.StatusBadRequest, "عملیات نامعتبر است (add/subtract/set)")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "موجودی کیف پول با موفقیت به‌روزرسانی شد"})
}

// -------------------------------------------------------------
// 6. Webhook Live Test
// -------------------------------------------------------------

func (s *Server) handleSalesBotWebhookTest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	db, _, err := getBotDB()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	port := 8085
	path := "/webhook/forapp"

	var portStr string
	_ = db.QueryRow(`SELECT value FROM settings WHERE key = 'forapp_port'`).Scan(&portStr)
	if p, err := strconv.Atoi(portStr); err == nil && p > 0 {
		port = p
	}

	targetURL := fmt.Sprintf("http://127.0.0.1:%d%s", port, path)
	client := &http.Client{Timeout: 3 * time.Second}

	resp, err := client.Get(targetURL)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"reachable": false,
			"target":    targetURL,
			"message":   fmt.Sprintf("سرویس وبهوک روی پورت %d در دسترس نیست یا بات خاموش است (%v)", port, err),
		})
		return
	}
	defer resp.Body.Close()

	writeJSON(w, http.StatusOK, map[string]any{
		"reachable":   true,
		"status_code": resp.StatusCode,
		"target":      targetURL,
		"message":     fmt.Sprintf("وبهوک فعال و پاسخگو است (کد وضعیت: %d)", resp.StatusCode),
	})
}

func parseSQLiteTime(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	for _, layout := range []string{
		"2006-01-02 15:04:05",
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Time{}
}

func (s *Server) runSalesBot(ctx context.Context) {
	time.Sleep(3 * time.Second) // wait for server to settle
	if salesbot.GetSetting("sales_bot_enabled", "true") == "true" && salesbot.GetSetting("bot_token", "") != "" {
		_ = salesbot.GetService().Start(ctx)
	}
}

func (s *Server) handlePublicForAppWebhook(w http.ResponseWriter, r *http.Request) {
	salesbot.GetService().HandleForAppWebhook(w, r)
}

