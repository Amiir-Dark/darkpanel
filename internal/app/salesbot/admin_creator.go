package salesbot

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/rebeccapanel/rebecca/internal/app/admin"
	platformdb "github.com/rebeccapanel/rebecca/internal/platform/db"
)

var (
	mainDBMu      sync.RWMutex
	mainDBConn    *sql.DB
	mainDBDialect string
)

// SetMainDB allows the server lifecycle to supply the active primary database connection
func SetMainDB(db *sql.DB, dialect string) {
	mainDBMu.Lock()
	defer mainDBMu.Unlock()
	mainDBConn = db
	mainDBDialect = dialect
}

// GetMainDB returns the primary database connection, auto-discovering if not explicitly set
func GetMainDB() (*sql.DB, string, error) {
	mainDBMu.RLock()
	if mainDBConn != nil {
		db := mainDBConn
		dialect := mainDBDialect
		mainDBMu.RUnlock()
		return db, dialect, nil
	}
	mainDBMu.RUnlock()

	mainDBMu.Lock()
	defer mainDBMu.Unlock()
	if mainDBConn != nil {
		return mainDBConn, mainDBDialect, nil
	}

	dbURL := resolveMainDatabaseURL()
	if dbURL == "" {
		return nil, "", fmt.Errorf("unable to resolve main database URL")
	}

	pool, err := platformdb.Open(dbURL)
	if err != nil {
		return nil, "", fmt.Errorf("failed to open primary database (%s): %w", dbURL, err)
	}

	mainDBConn = pool.DB
	mainDBDialect = pool.Dialect
	return mainDBConn, mainDBDialect, nil
}

func resolveMainDatabaseURL() string {
	// 1. Environment variables
	for _, env := range []string{"SQLALCHEMY_DATABASE_URL", "DATABASE_URL", "REBECCA_DATABASE_URL"} {
		if val := strings.TrimSpace(os.Getenv(env)); val != "" {
			return val
		}
	}

	// 2. Look in candidate .env files
	envCandidates := []string{
		"/opt/darkpanel/.env",
		"/opt/rebecca/.env",
		"/var/lib/darkpanel/.env",
		"/var/lib/rebecca/.env",
		".env",
	}
	if appDir := strings.TrimSpace(os.Getenv("REBECCA_APP_DIR")); appDir != "" {
		envCandidates = append([]string{filepath.Join(appDir, ".env")}, envCandidates...)
	}

	for _, path := range envCandidates {
		if val := readEnvKey(path, "SQLALCHEMY_DATABASE_URL"); val != "" {
			return val
		}
		if val := readEnvKey(path, "DATABASE_URL"); val != "" {
			return val
		}
	}

	// 3. Fallback to existing SQLite database files
	sqliteCandidates := []string{
		"/var/lib/darkpanel/db.sqlite3",
		"/var/lib/rebecca/db.sqlite3",
		"/opt/darkpanel/db.sqlite3",
		"/opt/rebecca/db.sqlite3",
		"db.sqlite3",
	}
	for _, path := range sqliteCandidates {
		if fi, err := os.Stat(path); err == nil && !fi.IsDir() {
			return "sqlite:///" + filepath.ToSlash(path)
		}
	}

	return "sqlite:///db.sqlite3"
}

func readEnvKey(filePath, key string) string {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return ""
	}
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 && strings.TrimSpace(parts[0]) == key {
			val := strings.TrimSpace(parts[1])
			val = strings.Trim(val, `"'`)
			return val
		}
	}
	return ""
}

func generateRandomUsername() string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 6)
	max := big.NewInt(int64(len(letters)))
	for i := range b {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			b[i] = letters[i%len(letters)]
		} else {
			b[i] = letters[n.Int64()]
		}
	}
	return fmt.Sprintf("test_%s", string(b))
}

func generateRandomPassword(length int) string {
	const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, length)
	max := big.NewInt(int64(len(chars)))
	for i := range b {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			b[i] = chars[i%len(chars)]
		} else {
			b[i] = chars[n.Int64()]
		}
	}
	return string(b)
}

func resolvePanelURL(mainDB *sql.DB) string {
	// 1. Explicit panel_url setting in salesbot
	if custom := strings.TrimSpace(GetSetting("panel_url", "")); custom != "" {
		return normalizeDashboardURL(custom)
	}

	// 2. sub_domain setting in salesbot
	if sub := strings.TrimSpace(GetSetting("sub_domain", "")); sub != "" {
		return normalizeDashboardURL(sub)
	}

	// 3. Check hosts table in primary DB
	if mainDB != nil {
		var address string
		var port int
		err := mainDB.QueryRow(`
			SELECT COALESCE(address, ''), COALESCE(port, 0)
			FROM hosts
			WHERE COALESCE(is_disabled, 0) = 0 AND address != ''
			ORDER BY id ASC LIMIT 1
		`).Scan(&address, &port)
		if err == nil && address != "" {
			if port == 443 {
				return fmt.Sprintf("https://%s/dashboard/", address)
			} else if port == 80 {
				return fmt.Sprintf("http://%s/dashboard/", address)
			} else if port > 0 {
				return fmt.Sprintf("http://%s:%d/dashboard/", address, port)
			}
			return fmt.Sprintf("https://%s/dashboard/", address)
		}
	}

	// 4. Environment PANEL_URL
	for _, env := range []string{"PANEL_URL", "REBECCA_PANEL_URL", "HOST"} {
		if val := strings.TrimSpace(os.Getenv(env)); val != "" {
			return normalizeDashboardURL(val)
		}
	}

	return ""
}

func normalizeDashboardURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if !strings.HasPrefix(raw, "http://") && !strings.HasPrefix(raw, "https://") {
		raw = "https://" + raw
	}
	raw = strings.TrimRight(raw, "/")
	if !strings.HasSuffix(raw, "/dashboard") && !strings.Contains(raw, "/dashboard/") {
		raw += "/dashboard/"
	} else if !strings.HasSuffix(raw, "/") {
		raw += "/"
	}
	return raw
}

// CreateTestAdmin creates a 1-day, 5 GB reseller admin account with random credentials
func CreateTestAdmin(ctx context.Context, tgID int64, firstName string) (username, password, panelURL string, err error) {
	mainDB, _, err := GetMainDB()
	if err != nil {
		return "", "", "", fmt.Errorf("database connection error: %w", err)
	}

	// 1. Generate unique random username
	var chosenUser string
	for attempts := 0; attempts < 10; attempts++ {
		candidate := generateRandomUsername()
		var count int
		err := mainDB.QueryRowContext(ctx, `SELECT COUNT(*) FROM admins WHERE LOWER(username) = LOWER(?)`, candidate).Scan(&count)
		if err == nil && count == 0 {
			chosenUser = candidate
			break
		}
	}
	if chosenUser == "" {
		chosenUser = fmt.Sprintf("test_%d_%d", tgID, time.Now().Unix()%1000)
	}

	// 2. Generate random password & hash
	rawPassword := generateRandomPassword(10)
	hash, err := admin.HashPassword(rawPassword)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to hash password: %w", err)
	}

	// 3. 5 GB data limit (in bytes) & 1 day expire (in unix timestamp seconds)
	dataLimit := int64(5 * 1024 * 1024 * 1024) // 5 GB
	expire := time.Now().UTC().Add(24 * time.Hour).Unix()

	// 4. Role & Permissions (Reseller)
	role := string(admin.RoleReseller)
	perms := admin.RoleDefaultPermissions(admin.RoleReseller)
	permsJSON, err := json.Marshal(perms)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to marshal permissions: %w", err)
	}

	// 5. Insert into admins table
	res, err := mainDB.ExecContext(ctx, `
		INSERT INTO admins (
			username, created_by, hashed_password, role, permissions, status,
			telegram_id, subscription_domain, subscription_settings, users_usage,
			lifetime_usage, created_traffic, deleted_users_usage, data_limit,
			traffic_limit_mode, use_service_traffic_limits, show_user_traffic,
			delete_user_usage_limit_enabled, delete_user_usage_limit, expire,
			users_limit, require_2fa
		) VALUES (?, 'salesbot', ?, ?, ?, 'active', ?, NULL, '{}', 0, 0, 0, 0, ?, 'used_traffic', 0, 1, 0, NULL, ?, NULL, 0)
	`, chosenUser, hash, role, string(permsJSON), tgID, dataLimit, expire)
	if err != nil {
		// Fallback in case older schema lacks created_by or require_2fa
		res, err = mainDB.ExecContext(ctx, `
			INSERT INTO admins (
				username, hashed_password, role, permissions, status,
				telegram_id, subscription_settings, users_usage, lifetime_usage,
				created_traffic, deleted_users_usage, data_limit, traffic_limit_mode,
				show_user_traffic, expire
			) VALUES (?, ?, ?, ?, 'active', ?, '{}', 0, 0, 0, 0, ?, 'used_traffic', 1, ?)
		`, chosenUser, hash, role, string(permsJSON), tgID, dataLimit, expire)
		if err != nil {
			return "", "", "", fmt.Errorf("failed to insert admin into database: %w", err)
		}
	}

	adminID, _ := res.LastInsertId()

	// 6. Assign all active services to this reseller so they can create users
	if adminID > 0 {
		assignAllServicesToAdmin(ctx, mainDB, adminID)
	}

	// 7. Resolve panel login URL
	panelURL = resolvePanelURL(mainDB)

	// 8. Record in sales bot SQLite database
	_ = MarkUserUsedTest(tgID)
	_ = ActivateUserPanel(tgID, chosenUser, rawPassword, panelURL)

	return chosenUser, rawPassword, panelURL, nil
}

// CreatePurchasedAdmin creates a Pay-As-You-Go reseller admin account, or upgrades an existing test panel
func CreatePurchasedAdmin(ctx context.Context, tgID int64, firstName string) (username, password, panelURL string, isUpgrade bool, err error) {
	mainDB, _, err := GetMainDB()
	if err != nil {
		return "", "", "", false, fmt.Errorf("database connection error: %w", err)
	}
	sqliteDB, _, err := GetDB()
	if err != nil {
		return "", "", "", false, fmt.Errorf("sqlite connection error: %w", err)
	}

	var existingUser User
	var uPanelUsername, uPanelPassword, uSubURL sql.NullString
	_ = sqliteDB.QueryRowContext(ctx, `
		SELECT panel_username, panel_password, sub_url
		FROM users WHERE telegram_id = ?
	`, tgID).Scan(&uPanelUsername, &uPanelPassword, &uSubURL)

	existingUser.PanelUsername = uPanelUsername.String
	existingUser.PanelPassword = uPanelPassword.String
	existingUser.SubURL = uSubURL.String

	panelURL = resolvePanelURL(mainDB)

	// If user already has an admin account (e.g. from test panel), upgrade it to Pay-As-You-Go!
	if existingUser.PanelUsername != "" {
		var adminExists int
		_ = mainDB.QueryRowContext(ctx, `SELECT COUNT(*) FROM admins WHERE LOWER(username) = LOWER(?)`, existingUser.PanelUsername).Scan(&adminExists)
		if adminExists > 0 {
			// Upgrade admin in DarkPanel: remove data_limit and expire so it is pay-as-you-go!
			_, _ = mainDB.ExecContext(ctx, `
				UPDATE admins
				SET data_limit = NULL, expire = NULL, status = 'active', disabled_reason = NULL
				WHERE LOWER(username) = LOWER(?)
			`, existingUser.PanelUsername)

			// Ensure all services are assigned
			var adminID int64
			_ = mainDB.QueryRowContext(ctx, `SELECT id FROM admins WHERE LOWER(username) = LOWER(?)`, existingUser.PanelUsername).Scan(&adminID)
			if adminID > 0 {
				assignAllServicesToAdmin(ctx, mainDB, adminID)
			}

			// Ensure usage_tracking baseline
			var currentBytes int64
			_ = mainDB.QueryRowContext(ctx, `SELECT COALESCE(lifetime_usage, 0) FROM admins WHERE id = ?`, adminID).Scan(&currentBytes)
			_, _ = sqliteDB.ExecContext(ctx, `
				INSERT INTO usage_tracking (user_id, panel_username, last_synced_bytes, total_billed_bytes, updated_at)
				VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
				ON CONFLICT(user_id) DO UPDATE SET panel_username = excluded.panel_username
			`, tgID, existingUser.PanelUsername, currentBytes)

			_ = ActivateUserPanel(tgID, existingUser.PanelUsername, existingUser.PanelPassword, panelURL)
			return existingUser.PanelUsername, existingUser.PanelPassword, panelURL, true, nil
		}
	}

	// Create fresh reseller admin account
	var chosenUser string
	for attempts := 0; attempts < 10; attempts++ {
		candidate := generateRandomUsername()
		var count int
		err := mainDB.QueryRowContext(ctx, `SELECT COUNT(*) FROM admins WHERE LOWER(username) = LOWER(?)`, candidate).Scan(&count)
		if err == nil && count == 0 {
			chosenUser = candidate
			break
		}
	}
	if chosenUser == "" {
		chosenUser = fmt.Sprintf("user_%d_%d", tgID, time.Now().Unix()%1000)
	}

	rawPassword := generateRandomPassword(10)
	hash, err := admin.HashPassword(rawPassword)
	if err != nil {
		return "", "", "", false, fmt.Errorf("failed to hash password: %w", err)
	}

	role := string(admin.RoleReseller)
	perms := admin.RoleDefaultPermissions(admin.RoleReseller)
	permsJSON, err := json.Marshal(perms)
	if err != nil {
		return "", "", "", false, fmt.Errorf("failed to marshal permissions: %w", err)
	}

	// Insert admin with data_limit = NULL and expire = NULL (Pay As You Go)
	res, err := mainDB.ExecContext(ctx, `
		INSERT INTO admins (
			username, created_by, hashed_password, role, permissions, status,
			telegram_id, subscription_domain, subscription_settings, users_usage,
			lifetime_usage, created_traffic, deleted_users_usage, data_limit,
			traffic_limit_mode, use_service_traffic_limits, show_user_traffic,
			delete_user_usage_limit_enabled, delete_user_usage_limit, expire,
			users_limit, require_2fa
		) VALUES (?, 'salesbot', ?, ?, ?, 'active', ?, NULL, '{}', 0, 0, 0, 0, NULL, 'used_traffic', 0, 1, 0, NULL, NULL, NULL, 0)
	`, chosenUser, hash, role, string(permsJSON), tgID)
	if err != nil {
		// Fallback in case of older schema
		res, err = mainDB.ExecContext(ctx, `
			INSERT INTO admins (
				username, hashed_password, role, permissions, status,
				telegram_id, subscription_settings, users_usage, lifetime_usage,
				created_traffic, deleted_users_usage, data_limit, traffic_limit_mode,
				show_user_traffic, expire
			) VALUES (?, ?, ?, ?, 'active', ?, '{}', 0, 0, 0, 0, NULL, 'used_traffic', 1, NULL)
		`, chosenUser, hash, role, string(permsJSON), tgID)
		if err != nil {
			return "", "", "", false, fmt.Errorf("failed to insert admin into database: %w", err)
		}
	}

	adminID, _ := res.LastInsertId()
	if adminID > 0 {
		assignAllServicesToAdmin(ctx, mainDB, adminID)
	}

	// Initialize usage tracking baseline at 0
	_, _ = sqliteDB.ExecContext(ctx, `
		INSERT INTO usage_tracking (user_id, panel_username, last_synced_bytes, total_billed_bytes, updated_at)
		VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP)
		ON CONFLICT(user_id) DO UPDATE SET panel_username = excluded.panel_username, last_synced_bytes = 0
	`, tgID, chosenUser)

	_ = ActivateUserPanel(tgID, chosenUser, rawPassword, panelURL)

	return chosenUser, rawPassword, panelURL, false, nil
}

// SyncAdminUsageBilling computes the delta traffic used by each reseller and bills the difference from their wallet
func SyncAdminUsageBilling(ctx context.Context, tgClient *TelegramClient, botToken string) {
	mainDB, _, err := GetMainDB()
	if err != nil || mainDB == nil {
		return
	}
	sqliteDB, _, err := GetDB()
	if err != nil || sqliteDB == nil {
		return
	}

	pricePerGB := GetSettingFloat("price_per_gb", 5000)
	if pricePerGB <= 0 {
		pricePerGB = 5000
	}

	rows, err := sqliteDB.QueryContext(ctx, `
		SELECT telegram_id, panel_username, panel_password, sub_url, wallet_balance, total_spent, service_status
		FROM users
		WHERE panel_username != '' AND service_status IN ('active', 'disabled')
	`)
	if err != nil {
		return
	}
	defer rows.Close()

	type billingTarget struct {
		telegramID    int64
		panelUsername string
		panelPassword string
		subURL        string
		walletBalance float64
		totalSpent    float64
		serviceStatus string
	}

	var targets []billingTarget
	for rows.Next() {
		var t billingTarget
		if err := rows.Scan(&t.telegramID, &t.panelUsername, &t.panelPassword, &t.subURL, &t.walletBalance, &t.totalSpent, &t.serviceStatus); err == nil {
			targets = append(targets, t)
		}
	}
	_ = rows.Close()

	for _, target := range targets {
		if strings.TrimSpace(target.panelUsername) == "" {
			continue
		}

		// 1. Get current usage from primary database
		var adminID int64
		var lifetimeUsage, usersUsage int64
		var adminStatus string
		err := mainDB.QueryRowContext(ctx, `
			SELECT id, COALESCE(lifetime_usage, 0), COALESCE(users_usage, 0), status
			FROM admins
			WHERE LOWER(username) = LOWER(?) AND status != 'deleted'
			LIMIT 1
		`, target.panelUsername).Scan(&adminID, &lifetimeUsage, &usersUsage, &adminStatus)
		if err != nil {
			continue
		}

		currentBytes := lifetimeUsage
		if currentBytes == 0 && usersUsage > 0 {
			currentBytes = usersUsage
		}

		// 2. Query usage_tracking baseline
		var lastSyncedBytes, totalBilledBytes int64
		err = sqliteDB.QueryRowContext(ctx, `
			SELECT last_synced_bytes, total_billed_bytes
			FROM usage_tracking
			WHERE user_id = ?
		`, target.telegramID).Scan(&lastSyncedBytes, &totalBilledBytes)

		if err == sql.ErrNoRows {
			// First time tracking this admin: set baseline to currentBytes without back-billing
			_, _ = sqliteDB.ExecContext(ctx, `
				INSERT INTO usage_tracking (user_id, panel_username, last_synced_bytes, total_billed_bytes, updated_at)
				VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
			`, target.telegramID, target.panelUsername, currentBytes)
			continue
		} else if err != nil {
			continue
		}

		// 3. Calculate delta usage
		if currentBytes <= lastSyncedBytes {
			// No new usage
			// If user's balance is positive and they were disabled, restore active
			if target.walletBalance > 0 && (adminStatus == "disabled" || target.serviceStatus == "disabled") {
				reactivateUserAndAdmin(ctx, mainDB, sqliteDB, tgClient, botToken, target.telegramID, target.panelUsername, target.subURL, target.walletBalance)
			}
			continue
		}

		deltaBytes := currentBytes - lastSyncedBytes
		deltaGB := float64(deltaBytes) / (1024.0 * 1024.0 * 1024.0)
		cost := deltaGB * pricePerGB

		newBalance := target.walletBalance - cost
		newTotalSpent := target.totalSpent + cost

		// 4. Update SQLite records
		_, _ = sqliteDB.ExecContext(ctx, `
			UPDATE users
			SET wallet_balance = ?, total_spent = ?
			WHERE telegram_id = ?
		`, newBalance, newTotalSpent, target.telegramID)

		_, _ = sqliteDB.ExecContext(ctx, `
			UPDATE usage_tracking
			SET last_synced_bytes = ?, total_billed_bytes = total_billed_bytes + ?, updated_at = CURRENT_TIMESTAMP
			WHERE user_id = ?
		`, currentBytes, deltaBytes, target.telegramID)

		// 5. Handle low or negative balance
		if newBalance <= 0 {
			if adminStatus != "disabled" || target.serviceStatus != "disabled" {
				_, _ = mainDB.ExecContext(ctx, `
					UPDATE admins
					SET status = 'disabled', disabled_reason = 'اتمام موجودی کیف پول'
					WHERE LOWER(username) = LOWER(?)
				`, target.panelUsername)

				_, _ = sqliteDB.ExecContext(ctx, `
					UPDATE users
					SET service_status = 'disabled'
					WHERE telegram_id = ?
				`, target.telegramID)

				if tgClient != nil && botToken != "" {
					alertText := fmt.Sprintf(
						"⚠️ <b>هشدار اتمام موجودی کیف پول</b>\n\n"+
							"👤 نماینده گرامی (<code>%s</code>)،\n"+
							"به دلیل مصرف ترافیک، موجودی کیف پول شما به پایان رسید (<code>%s تومان</code>) و پنل شما موقتاً غیرفعال شد.\n\n"+
							"💡 جهت اتصال مجدد سرویس‌ها، لطفاً از دکمه زیر نسبت به افزایش موجودی اقدام فرمایید.",
						target.panelUsername, formatCurrency(newBalance),
					)
					_ = tgClient.SendMessage(ctx, botToken, target.telegramID, alertText, depositOnlyKeyboard())
				}
			}
		} else if adminStatus == "disabled" || target.serviceStatus == "disabled" {
			// Balance is positive, re-enable!
			reactivateUserAndAdmin(ctx, mainDB, sqliteDB, tgClient, botToken, target.telegramID, target.panelUsername, target.subURL, newBalance)
		}
	}
}

func reactivateUserAndAdmin(ctx context.Context, mainDB *sql.DB, sqliteDB *sql.DB, tgClient *TelegramClient, botToken string, tgID int64, username, panelURL string, balance float64) {
	_, _ = mainDB.ExecContext(ctx, `
		UPDATE admins
		SET status = 'active', disabled_reason = NULL
		WHERE LOWER(username) = LOWER(?)
	`, username)

	_, _ = sqliteDB.ExecContext(ctx, `
		UPDATE users
		SET service_status = 'active'
		WHERE telegram_id = ?
	`, tgID)

	if tgClient != nil && botToken != "" {
		resumedText := fmt.Sprintf(
			"✅ <b>پنل نمایندگی شما مجدداً فعال شد</b>\n\n"+
				"👤 نماینده گرامی (<code>%s</code>)، با توجه به موجودی کیف پول شما (<code>%s تومان</code>)، پنل نمایندگی و کلیه اتصالات مجدداً فعال گردید.",
			username, formatCurrency(balance),
		)
		_ = tgClient.SendMessage(ctx, botToken, tgID, resumedText, myPanelsKeyboard(true, panelURL))
	}
}

// ReactivateAdminIfPaid re-enables a suspended admin if user's wallet is credited
func ReactivateAdminIfPaid(tgID int64) {
	sqliteDB, _, err := GetDB()
	if err != nil || sqliteDB == nil {
		return
	}
	mainDB, _, err := GetMainDB()
	if err != nil || mainDB == nil {
		return
	}

	var panelUser string
	var balance float64
	var status string
	err = sqliteDB.QueryRow(`
		SELECT panel_username, wallet_balance, service_status
		FROM users WHERE telegram_id = ?
	`, tgID).Scan(&panelUser, &balance, &status)
	if err != nil || panelUser == "" {
		return
	}

	if balance > 0 && status == "disabled" {
		_, _ = mainDB.Exec(`
			UPDATE admins
			SET status = 'active', disabled_reason = NULL
			WHERE LOWER(username) = LOWER(?)
		`, panelUser)

		_, _ = sqliteDB.Exec(`
			UPDATE users
			SET service_status = 'active'
			WHERE telegram_id = ?
		`, tgID)
	}
}

func assignAllServicesToAdmin(ctx context.Context, db *sql.DB, adminID int64) {
	rows, err := db.QueryContext(ctx, `SELECT id FROM services`)
	if err != nil {
		return
	}
	defer rows.Close()

	var serviceIDs []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err == nil {
			serviceIDs = append(serviceIDs, id)
		}
	}

	now := time.Now().UTC().Format("2006-01-02 15:04:05")
	for _, sID := range serviceIDs {
		_, _ = db.ExecContext(ctx, `
			INSERT INTO service_admins (
				admin_id, service_id, used_traffic, lifetime_used_traffic,
				created_traffic, deleted_users_usage, data_limit, traffic_limit_mode,
				show_user_traffic, users_limit, delete_user_usage_limit_enabled,
				created_at, updated_at
			) VALUES (?, ?, 0, 0, 0, 0, NULL, 'used_traffic', 1, NULL, 0, ?, ?)
		`, adminID, sID, now, now)

		_, _ = db.ExecContext(ctx, `
			INSERT INTO admins_services (admin_id, service_id, used_traffic, lifetime_used_traffic)
			VALUES (?, ?, 0, 0)
		`, adminID, sID)
	}
}
