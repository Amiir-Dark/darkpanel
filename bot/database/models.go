package database

import (
	"database/sql"
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

func (d *DB) GetUser(tgID int64) (*User, error) {
	row := d.db.QueryRow(`
		SELECT telegram_id, username, first_name, wallet_balance, panel_username, sub_url, service_status, total_spent, created_at 
		FROM users WHERE telegram_id = ?`, tgID)

	var u User
	err := row.Scan(&u.TelegramID, &u.Username, &u.FirstName, &u.WalletBalance, &u.PanelUsername, &u.SubURL, &u.ServiceStatus, &u.TotalSpent, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (d *DB) GetUserByPanelUsername(panelUsername string) (*User, error) {
	row := d.db.QueryRow(`
		SELECT telegram_id, username, first_name, wallet_balance, panel_username, sub_url, service_status, total_spent, created_at 
		FROM users WHERE panel_username = ?`, panelUsername)

	var u User
	err := row.Scan(&u.TelegramID, &u.Username, &u.FirstName, &u.WalletBalance, &u.PanelUsername, &u.SubURL, &u.ServiceStatus, &u.TotalSpent, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (d *DB) CreateOrUpdateUser(tgID int64, username, firstName string) (*User, error) {
	existing, err := d.GetUser(tgID)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		_, err := d.db.Exec(`
			INSERT INTO users (telegram_id, username, first_name, wallet_balance, service_status, created_at)
			VALUES (?, ?, ?, 0, 'none', ?)`, tgID, username, firstName, time.Now())
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
		if err := rows.Scan(&u.TelegramID, &u.Username, &u.FirstName, &u.WalletBalance, &u.PanelUsername, &u.SubURL, &u.ServiceStatus, &u.TotalSpent, &u.CreatedAt); err == nil {
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
		if err := rows.Scan(&u.TelegramID, &u.Username, &u.FirstName, &u.WalletBalance, &u.PanelUsername, &u.SubURL, &u.ServiceStatus, &u.TotalSpent, &u.CreatedAt); err == nil {
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
	err := row.Scan(&r.UserID, &r.PanelUsername, &r.LastSyncedBytes, &r.TotalBilledBytes, &r.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (d *DB) SaveUsageTracking(r *UsageRecord) error {
	_, err := d.db.Exec(`
		INSERT INTO usage_tracking (user_id, panel_username, last_synced_bytes, total_billed_bytes, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			panel_username = excluded.panel_username,
			last_synced_bytes = excluded.last_synced_bytes,
			total_billed_bytes = excluded.total_billed_bytes,
			updated_at = excluded.updated_at`,
		r.UserID, r.PanelUsername, r.LastSyncedBytes, r.TotalBilledBytes, time.Now())
	return err
}

func (d *DB) CreateReceipt(userID int64, amount float64, fileID string) (int64, error) {
	res, err := d.db.Exec(`
		INSERT INTO receipts (user_id, amount, file_id, status, created_at)
		VALUES (?, ?, ?, 'pending', ?)`, userID, amount, fileID, time.Now())
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
	err := row.Scan(&r.ID, &r.UserID, &r.Amount, &r.FileID, &r.Status, &r.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
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
