package database

import (
	"database/sql"
	"strconv"
	"strings"
	"time"
)

type User struct {
	TelegramID    int64
	Username      string
	FirstName     string
	WalletBalance float64
	PanelUsername string
	SubURL        string
	ServiceStatus string // none, active, suspended, trial
	TotalSpent    float64
	CreatedAt     time.Time
}

type Receipt struct {
	ID        int64
	UserID    int64
	Amount    float64
	FileID    string
	Status    string // pending, approved, rejected
	CreatedAt time.Time
}

type UsageRecord struct {
	UserID           int64
	PanelUsername    string
	LastSyncedBytes  int64
	TotalBilledBytes int64
	UpdatedAt        time.Time
}

type Stats struct {
	TotalUsers     int64
	ActiveServices int64
	TotalDeposited float64
	TotalTrafficGB float64
}

type NullableTime struct {
	time.Time
}

func (nt *NullableTime) Scan(value any) error {
	if value == nil {
		nt.Time = time.Time{}
		return nil
	}
	nt.Time = parseTime(value)
	return nil
}

func parseTime(v any) time.Time {
	if v == nil {
		return time.Time{}
	}
	switch t := v.(type) {
	case time.Time:
		return t
	case string:
		for _, layout := range []string{
			"2006-01-02 15:04:05",
			time.RFC3339,
			time.RFC3339Nano,
			"2006-01-02T15:04:05Z07:00",
			"2006-01-02 15:04:05.999999999-07:00",
			"2006-01-02 15:04:05.999999999",
			"2006-01-02",
		} {
			if parsed, err := time.Parse(layout, t); err == nil {
				return parsed
			}
		}
	}
	return time.Time{}
}

func (d *DB) GetUser(tgID int64) (*User, error) {
	row := d.db.QueryRow(`
		SELECT telegram_id, username, first_name, wallet_balance, panel_username, sub_url, service_status, total_spent, created_at 
		FROM users WHERE telegram_id = ?`, tgID)

	var u User
	var createdAt NullableTime
	err := row.Scan(&u.TelegramID, &u.Username, &u.FirstName, &u.WalletBalance, &u.PanelUsername, &u.SubURL, &u.ServiceStatus, &u.TotalSpent, &createdAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.CreatedAt = createdAt.Time
	return &u, nil
}

func (d *DB) GetUserByPanelUsername(panelUsername string) (*User, error) {
	row := d.db.QueryRow(`
		SELECT telegram_id, username, first_name, wallet_balance, panel_username, sub_url, service_status, total_spent, created_at 
		FROM users WHERE panel_username = ?`, panelUsername)

	var u User
	var createdAt NullableTime
	err := row.Scan(&u.TelegramID, &u.Username, &u.FirstName, &u.WalletBalance, &u.PanelUsername, &u.SubURL, &u.ServiceStatus, &u.TotalSpent, &createdAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.CreatedAt = createdAt.Time
	return &u, nil
}

func (d *DB) CreateOrUpdateUser(tgID int64, username, firstName string) (*User, error) {
	existing, err := d.GetUser(tgID)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		nowStr := time.Now().UTC().Format("2006-01-02 15:04:05")
		_, err := d.db.Exec(`
			INSERT INTO users (telegram_id, username, first_name, wallet_balance, service_status, created_at)
			VALUES (?, ?, ?, 0, 'none', ?)`, tgID, username, firstName, nowStr)
		if err != nil {
			return nil, err
		}
		return d.GetUser(tgID)
	}

	// Update username / name if changed
	_, _ = d.db.Exec(`UPDATE users SET username = ?, first_name = ? WHERE telegram_id = ?`, username, firstName, tgID)
	existing.Username = username
	existing.FirstName = firstName
	return existing, nil
}

func (d *DB) UpdateWallet(tgID int64, delta float64) (float64, error) {
	tx, err := d.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	var current float64
	err = tx.QueryRow(`SELECT wallet_balance FROM users WHERE telegram_id = ?`, tgID).Scan(&current)
	if err != nil {
		return 0, err
	}

	newBalance := current + delta
	if delta < 0 {
		_, err = tx.Exec(`UPDATE users SET wallet_balance = ?, total_spent = total_spent + ? WHERE telegram_id = ?`,
			newBalance, -delta, tgID)
	} else {
		_, err = tx.Exec(`UPDATE users SET wallet_balance = ? WHERE telegram_id = ?`, newBalance, tgID)
	}
	if err != nil {
		return 0, err
	}

	return newBalance, tx.Commit()
}

func (d *DB) SetServiceStatus(tgID int64, status, panelUsername, subURL string) error {
	_, err := d.db.Exec(`
		UPDATE users 
		SET service_status = ?, panel_username = ?, sub_url = ?
		WHERE telegram_id = ?`, status, panelUsername, subURL, tgID)
	return err
}

func (d *DB) UpdateServiceStateOnly(tgID int64, status string) error {
	_, err := d.db.Exec(`UPDATE users SET service_status = ? WHERE telegram_id = ?`, status, tgID)
	return err
}

func (d *DB) GetActiveUsers() ([]User, error) {
	rows, err := d.db.Query(`
		SELECT telegram_id, username, first_name, wallet_balance, panel_username, sub_url, service_status, total_spent, created_at
		FROM users 
		WHERE service_status = 'active' AND panel_username != ''`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []User
	for rows.Next() {
		var u User
		var createdAt NullableTime
		if err := rows.Scan(&u.TelegramID, &u.Username, &u.FirstName, &u.WalletBalance, &u.PanelUsername, &u.SubURL, &u.ServiceStatus, &u.TotalSpent, &createdAt); err == nil {
			u.CreatedAt = createdAt.Time
			list = append(list, u)
		}
	}
	return list, nil
}

func (d *DB) GetAllUsers() ([]User, error) {
	rows, err := d.db.Query(`
		SELECT telegram_id, username, first_name, wallet_balance, panel_username, sub_url, service_status, total_spent, created_at
		FROM users 
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []User
	for rows.Next() {
		var u User
		var createdAt NullableTime
		if err := rows.Scan(&u.TelegramID, &u.Username, &u.FirstName, &u.WalletBalance, &u.PanelUsername, &u.SubURL, &u.ServiceStatus, &u.TotalSpent, &createdAt); err == nil {
			u.CreatedAt = createdAt.Time
			list = append(list, u)
		}
	}
	return list, nil
}

func (d *DB) GetUsageTracking(tgID int64) (*UsageRecord, error) {
	row := d.db.QueryRow(`
		SELECT user_id, panel_username, last_synced_bytes, total_billed_bytes, updated_at
		FROM usage_tracking WHERE user_id = ?`, tgID)

	var r UsageRecord
	var updatedAt NullableTime
	err := row.Scan(&r.UserID, &r.PanelUsername, &r.LastSyncedBytes, &r.TotalBilledBytes, &updatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	r.UpdatedAt = updatedAt.Time
	return &r, nil
}

func (d *DB) SaveUsageTracking(r *UsageRecord) error {
	nowStr := time.Now().UTC().Format("2006-01-02 15:04:05")
	_, err := d.db.Exec(`
		INSERT INTO usage_tracking (user_id, panel_username, last_synced_bytes, total_billed_bytes, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			panel_username = excluded.panel_username,
			last_synced_bytes = excluded.last_synced_bytes,
			total_billed_bytes = excluded.total_billed_bytes,
			updated_at = excluded.updated_at`,
		r.UserID, r.PanelUsername, r.LastSyncedBytes, r.TotalBilledBytes, nowStr)
	return err
}

func (d *DB) CreateReceipt(userID int64, amount float64, fileID string) (int64, error) {
	nowStr := time.Now().UTC().Format("2006-01-02 15:04:05")
	res, err := d.db.Exec(`
		INSERT INTO receipts (user_id, amount, file_id, status, created_at)
		VALUES (?, ?, ?, 'pending', ?)`, userID, amount, fileID, nowStr)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (d *DB) GetReceipt(id int64) (*Receipt, error) {
	row := d.db.QueryRow(`
		SELECT id, user_id, amount, file_id, status, created_at
		FROM receipts WHERE id = ?`, id)

	var r Receipt
	var createdAt NullableTime
	err := row.Scan(&r.ID, &r.UserID, &r.Amount, &r.FileID, &r.Status, &createdAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	r.CreatedAt = createdAt.Time
	return &r, nil
}

func (d *DB) UpdateReceiptStatus(id int64, status string) error {
	_, err := d.db.Exec(`UPDATE receipts SET status = ? WHERE id = ?`, status, id)
	return err
}

func (d *DB) GetSetting(key, defaultVal string) string {
	var val string
	err := d.db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&val)
	if err != nil || val == "" {
		return defaultVal
	}
	return val
}

func (d *DB) SetSetting(key, val string) error {
	_, err := d.db.Exec(`
		INSERT INTO settings (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, val)
	return err
}

func (d *DB) GetUserState(tgID int64) (string, string) {
	var state, data string
	_ = d.db.QueryRow(`SELECT state, data FROM user_states WHERE user_id = ?`, tgID).Scan(&state, &data)
	return state, data
}

func (d *DB) SetUserState(tgID int64, state, data string) {
	_, _ = d.db.Exec(`
		INSERT INTO user_states (user_id, state, data) VALUES (?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, data = excluded.data`,
		tgID, state, data)
}

func (d *DB) ClearUserState(tgID int64) {
	_, _ = d.db.Exec(`DELETE FROM user_states WHERE user_id = ?`, tgID)
}

func (d *DB) GetStats() (*Stats, error) {
	var s Stats
	_ = d.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&s.TotalUsers)
	_ = d.db.QueryRow(`SELECT COUNT(*) FROM users WHERE service_status = 'active'`).Scan(&s.ActiveServices)
	_ = d.db.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM receipts WHERE status = 'approved'`).Scan(&s.TotalDeposited)

	var totalBytes int64
	_ = d.db.QueryRow(`SELECT COALESCE(SUM(total_billed_bytes), 0) FROM usage_tracking`).Scan(&totalBytes)
	s.TotalTrafficGB = float64(totalBytes) / (1024 * 1024 * 1024)

	return &s, nil
}

type ReceiptWithUser struct {
	ID        int64
	UserID    int64
	Username  string
	FirstName string
	Amount    float64
	FileID    string
	Status    string
	CreatedAt time.Time
}

type FinancialStats struct {
	TotalApproved        float64
	TodayApproved        float64
	WeekApproved         float64
	TotalPendingCount    int64
	TotalPendingAmount   float64
	TotalRejectedCount   int64
	TotalBilledTrafficGB float64
	TotalBilledRevenue   float64
}

func (d *DB) GetFinancialStats(pricePerGB float64) (*FinancialStats, error) {
	var s FinancialStats

	// Total approved
	_ = d.db.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM receipts WHERE status = 'approved'`).Scan(&s.TotalApproved)

	// Today approved
	_ = d.db.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM receipts WHERE status = 'approved' AND date(created_at) = date('now')`).Scan(&s.TodayApproved)

	// Week approved
	_ = d.db.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM receipts WHERE status = 'approved' AND created_at >= datetime('now', '-7 days')`).Scan(&s.WeekApproved)

	// Pending
	_ = d.db.QueryRow(`SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM receipts WHERE status = 'pending'`).Scan(&s.TotalPendingCount, &s.TotalPendingAmount)

	// Rejected
	_ = d.db.QueryRow(`SELECT COUNT(*) FROM receipts WHERE status = 'rejected'`).Scan(&s.TotalRejectedCount)

	// Billed traffic & revenue
	var totalBytes int64
	_ = d.db.QueryRow(`SELECT COALESCE(SUM(total_billed_bytes), 0) FROM usage_tracking`).Scan(&totalBytes)
	s.TotalBilledTrafficGB = float64(totalBytes) / (1024 * 1024 * 1024)
	s.TotalBilledRevenue = s.TotalBilledTrafficGB * pricePerGB

	return &s, nil
}

func (d *DB) GetRecentTransactions(limit int) ([]ReceiptWithUser, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := d.db.Query(`
		SELECT r.id, r.user_id, COALESCE(u.username, ''), COALESCE(u.first_name, ''), r.amount, r.file_id, r.status, r.created_at
		FROM receipts r
		LEFT JOIN users u ON r.user_id = u.telegram_id
		ORDER BY r.created_at DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ReceiptWithUser
	for rows.Next() {
		var item ReceiptWithUser
		var createdAt NullableTime
		if err := rows.Scan(&item.ID, &item.UserID, &item.Username, &item.FirstName, &item.Amount, &item.FileID, &item.Status, &createdAt); err == nil {
			item.CreatedAt = createdAt.Time
			list = append(list, item)
		}
	}
	return list, nil
}

func (d *DB) GetPendingReceipts() ([]ReceiptWithUser, error) {
	rows, err := d.db.Query(`
		SELECT r.id, r.user_id, COALESCE(u.username, ''), COALESCE(u.first_name, ''), r.amount, r.file_id, r.status, r.created_at
		FROM receipts r
		LEFT JOIN users u ON r.user_id = u.telegram_id
		WHERE r.status = 'pending'
		ORDER BY r.created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ReceiptWithUser
	for rows.Next() {
		var item ReceiptWithUser
		var createdAt NullableTime
		if err := rows.Scan(&item.ID, &item.UserID, &item.Username, &item.FirstName, &item.Amount, &item.FileID, &item.Status, &createdAt); err == nil {
			item.CreatedAt = createdAt.Time
			list = append(list, item)
		}
	}
	return list, nil
}

type Order struct {
	ID          int64     `json:"id"`
	UserID      int64     `json:"user_id"`
	AmountBase  float64   `json:"amount_base"`
	AmountExact float64   `json:"amount_exact"`
	Code        string    `json:"code"`
	Status      string    `json:"status"` // pending, paid, expired, cancelled
	BankRef     string    `json:"bank_ref"`
	CreatedAt   time.Time `json:"created_at"`
	ExpiresAt   time.Time `json:"expires_at"`
}

func FormatMoney(amount float64) string {
	n := int64(amount)
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	s := strconv.FormatInt(n, 10)
	var parts []string
	for len(s) > 3 {
		parts = append([]string{s[len(s)-3:]}, parts...)
		s = s[:len(s)-3]
	}
	if len(s) > 0 {
		parts = append([]string{s}, parts...)
	}
	res := strings.Join(parts, ",")
	if neg {
		return "-" + res
	}
	return res
}

func (d *DB) CreateOrder(userID int64, amountBase, amountExact float64, code string, durationMinutes int) (*Order, error) {
	// Cancel any existing pending orders for this user
	_, _ = d.db.Exec(`UPDATE orders SET status = 'cancelled' WHERE user_id = ? AND status = 'pending'`, userID)

	now := time.Now().UTC()
	expiresAt := now.Add(time.Duration(durationMinutes) * time.Minute)
	nowStr := now.Format("2006-01-02 15:04:05")
	expiresStr := expiresAt.Format("2006-01-02 15:04:05")

	res, err := d.db.Exec(`
		INSERT INTO orders (user_id, amount_base, amount_exact, code, status, created_at, expires_at)
		VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
		userID, amountBase, amountExact, code, nowStr, expiresStr)
	if err != nil {
		return nil, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

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

func (d *DB) GetOrder(id int64) (*Order, error) {
	row := d.db.QueryRow(`
		SELECT id, user_id, amount_base, amount_exact, code, status, bank_ref, created_at, expires_at
		FROM orders WHERE id = ?`, id)

	var o Order
	var createdAt, expiresAt NullableTime
	err := row.Scan(&o.ID, &o.UserID, &o.AmountBase, &o.AmountExact, &o.Code, &o.Status, &o.BankRef, &createdAt, &expiresAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	o.CreatedAt = createdAt.Time
	o.ExpiresAt = expiresAt.Time
	return &o, nil
}

func (d *DB) GetPendingOrderByExactAmount(exactAmount float64) (*Order, error) {
	row := d.db.QueryRow(`
		SELECT id, user_id, amount_base, amount_exact, code, status, bank_ref, created_at, expires_at
		FROM orders
		WHERE status = 'pending' AND expires_at > datetime('now') AND amount_exact = ?
		ORDER BY id DESC LIMIT 1`, exactAmount)

	var o Order
	var createdAt, expiresAt NullableTime
	err := row.Scan(&o.ID, &o.UserID, &o.AmountBase, &o.AmountExact, &o.Code, &o.Status, &o.BankRef, &createdAt, &expiresAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	o.CreatedAt = createdAt.Time
	o.ExpiresAt = expiresAt.Time
	return &o, nil
}

func (d *DB) GetPendingOrderByCode(amountBase float64, code string) (*Order, error) {
	row := d.db.QueryRow(`
		SELECT id, user_id, amount_base, amount_exact, code, status, bank_ref, created_at, expires_at
		FROM orders
		WHERE status = 'pending' AND expires_at > datetime('now') AND amount_base = ? AND code = ?
		ORDER BY id DESC LIMIT 1`, amountBase, code)

	var o Order
	var createdAt, expiresAt NullableTime
	err := row.Scan(&o.ID, &o.UserID, &o.AmountBase, &o.AmountExact, &o.Code, &o.Status, &o.BankRef, &createdAt, &expiresAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	o.CreatedAt = createdAt.Time
	o.ExpiresAt = expiresAt.Time
	return &o, nil
}

func (d *DB) IsExactAmountTaken(exactAmount float64) bool {
	var count int
	_ = d.db.QueryRow(`
		SELECT COUNT(*) FROM orders
		WHERE status = 'pending' AND expires_at > datetime('now') AND amount_exact = ?`, exactAmount).Scan(&count)
	return count > 0
}

func (d *DB) GetExpiredPendingOrders() ([]Order, error) {
	rows, err := d.db.Query(`
		SELECT id, user_id, amount_base, amount_exact, code, status, bank_ref, created_at, expires_at
		FROM orders
		WHERE status = 'pending' AND expires_at <= datetime('now')`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Order
	for rows.Next() {
		var o Order
		var createdAt, expiresAt NullableTime
		if err := rows.Scan(&o.ID, &o.UserID, &o.AmountBase, &o.AmountExact, &o.Code, &o.Status, &o.BankRef, &createdAt, &expiresAt); err == nil {
			o.CreatedAt = createdAt.Time
			o.ExpiresAt = expiresAt.Time
			list = append(list, o)
		}
	}
	return list, nil
}

func (d *DB) MarkOrderPaid(id int64, bankRef string) error {
	_, err := d.db.Exec(`UPDATE orders SET status = 'paid', bank_ref = ? WHERE id = ? AND status = 'pending'`, bankRef, id)
	return err
}

func (d *DB) MarkOrderExpired(id int64) error {
	_, err := d.db.Exec(`UPDATE orders SET status = 'expired' WHERE id = ? AND status = 'pending'`, id)
	return err
}

func (d *DB) CancelUserPendingOrders(userID int64) error {
	_, err := d.db.Exec(`UPDATE orders SET status = 'cancelled' WHERE user_id = ? AND status = 'pending'`, userID)
	return err
}

func (d *DB) GetRecentOrders(limit int) ([]Order, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := d.db.Query(`
		SELECT id, user_id, amount_base, amount_exact, code, status, bank_ref, created_at, expires_at
		FROM orders
		ORDER BY id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Order
	for rows.Next() {
		var o Order
		var createdAt, expiresAt NullableTime
		if err := rows.Scan(&o.ID, &o.UserID, &o.AmountBase, &o.AmountExact, &o.Code, &o.Status, &o.BankRef, &createdAt, &expiresAt); err == nil {
			o.CreatedAt = createdAt.Time
			o.ExpiresAt = expiresAt.Time
			list = append(list, o)
		}
	}
	return list, nil
}


