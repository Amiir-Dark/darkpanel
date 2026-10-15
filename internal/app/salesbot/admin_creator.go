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
	"strconv"
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
	maxPanels := GetMaxPanelsPerUser()
	if maxPanels > 0 {
		activeCount := GetUserActivePanelCount(tgID)
		if activeCount >= maxPanels {
			return "", "", "", fmt.Errorf("MAX_LIMIT_REACHED")
		}
	}

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

	// 3. Dynamic test traffic limit (in bytes) & expire (in unix timestamp seconds) from settings
	testGB := GetSettingFloat("test_traffic_gb", 5)
	if testGB <= 0 {
		testGB = 5
	}
	dataLimit := int64(testGB * 1024 * 1024 * 1024)

	durationHours := GetSettingInt("test_duration_hours", 24)
	if durationHours <= 0 {
		durationHours = 24
	}
	expire := time.Now().UTC().Add(time.Duration(durationHours) * time.Hour).Unix()

	// 4. Role & Permissions (Reseller without hosts/inbounds access)
	role := string(admin.RoleReseller)
	perms := admin.RoleDefaultPermissions(admin.RoleReseller)
	perms.Sections.Hosts = false
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

	// 6. Assign configured services to this reseller so they can create users
	if adminID > 0 {
		assignConfiguredServicesToAdmin(ctx, mainDB, adminID)
	}

	// 7. Resolve panel login URL
	panelURL = resolvePanelURL(mainDB)

	// 8. Record in sales bot SQLite database
	_ = MarkUserUsedTest(tgID)
	_ = ActivateUserPanel(tgID, chosenUser, rawPassword, panelURL, "test")

	return chosenUser, rawPassword, panelURL, nil
}

// CreatePurchasedAdmin creates a Pay-As-You-Go reseller admin account, or upgrades an existing test panel
func CreatePurchasedAdmin(ctx context.Context, tgID int64, firstName string) (username, password, panelURL string, isUpgrade bool, err error) {
	maxPanels := GetMaxPanelsPerUser()
	if maxPanels > 0 {
		activeCount := GetUserActivePanelCount(tgID)
		if activeCount >= maxPanels {
			return "", "", "", false, fmt.Errorf("MAX_LIMIT_REACHED")
		}
	}

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

	// If user currently has an existing test panel (and no other panel), upgrade it to Pay-As-You-Go!
	if existingUser.PanelUsername != "" && strings.HasPrefix(existingUser.PanelUsername, "test_") {
		var adminExists int
		_ = mainDB.QueryRowContext(ctx, `SELECT COUNT(*) FROM admins WHERE LOWER(username) = LOWER(?)`, existingUser.PanelUsername).Scan(&adminExists)
		if adminExists > 0 {
			cleanPerms := admin.RoleDefaultPermissions(admin.RoleReseller)
			cleanPerms.Sections.Hosts = false
			cleanPermsJSON, _ := json.Marshal(cleanPerms)

			// Upgrade admin in DarkPanel: remove data_limit and expire so it is pay-as-you-go, ensure hosts section is disabled!
			_, _ = mainDB.ExecContext(ctx, `
				UPDATE admins
				SET data_limit = NULL, expire = NULL, status = 'active', disabled_reason = NULL, permissions = ?
				WHERE LOWER(username) = LOWER(?)
			`, string(cleanPermsJSON), existingUser.PanelUsername)

			// Ensure configured services are assigned
			var adminID int64
			_ = mainDB.QueryRowContext(ctx, `SELECT id FROM admins WHERE LOWER(username) = LOWER(?)`, existingUser.PanelUsername).Scan(&adminID)
			if adminID > 0 {
				assignConfiguredServicesToAdmin(ctx, mainDB, adminID)
			}

			// Ensure usage_tracking baseline
			var currentBytes int64
			_ = mainDB.QueryRowContext(ctx, `SELECT COALESCE(lifetime_usage, 0) FROM admins WHERE id = ?`, adminID).Scan(&currentBytes)
			_, _ = sqliteDB.ExecContext(ctx, `
				INSERT INTO usage_tracking (user_id, panel_username, last_synced_bytes, total_billed_bytes, updated_at)
				VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
				ON CONFLICT(user_id) DO UPDATE SET panel_username = excluded.panel_username
			`, tgID, existingUser.PanelUsername, currentBytes)

			_ = ActivateUserPanel(tgID, existingUser.PanelUsername, existingUser.PanelPassword, panelURL, "payg")
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
	perms.Sections.Hosts = false
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
		assignConfiguredServicesToAdmin(ctx, mainDB, adminID)
	}

	// Initialize usage tracking baseline at 0
	_, _ = sqliteDB.ExecContext(ctx, `
		INSERT INTO usage_tracking (user_id, panel_username, last_synced_bytes, total_billed_bytes, updated_at)
		VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP)
		ON CONFLICT(user_id) DO UPDATE SET panel_username = excluded.panel_username, last_synced_bytes = 0
	`, tgID, chosenUser)

	_ = ActivateUserPanel(tgID, chosenUser, rawPassword, panelURL, "payg")

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

	// Sanitize existing reseller permissions in main database to ensure hosts#inbounds is not granted
	sanitizeResellerPermissions(ctx, mainDB)

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
		var dataLimit, expire int64
		err := mainDB.QueryRowContext(ctx, `
			SELECT id, COALESCE(lifetime_usage, 0), COALESCE(users_usage, 0), status,
			       COALESCE(data_limit, 0), COALESCE(expire, 0)
			FROM admins
			WHERE LOWER(username) = LOWER(?) AND status != 'deleted'
			LIMIT 1
		`, target.panelUsername).Scan(&adminID, &lifetimeUsage, &usersUsage, &adminStatus, &dataLimit, &expire)
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

		// 5. Smart Notifications (Low Balance, Low Traffic, Expiry)
		notifyLowBalance := GetSetting("notify_low_balance_enabled", "true") != "false"
		lowBalanceThreshold := GetSettingFloat("low_balance_threshold", 10000)

		notifyLowTraffic := GetSetting("notify_low_traffic_enabled", "true") != "false"
		lowTrafficThresholdGB := GetSettingFloat("low_traffic_threshold_gb", 1.0)

		notifyExpiry := GetSetting("notify_expiry_enabled", "true") != "false"
		expiryThresholdHours := int64(GetSettingInt("expiry_threshold_hours", 12))

		// 5.1 Low Balance Notification
		if newBalance > 0 && notifyLowBalance && newBalance <= lowBalanceThreshold {
			if CanSendUserNotification(target.telegramID, "low_balance", 24) && tgClient != nil && botToken != "" {
				alertText := fmt.Sprintf(
					"⚠️ <b>هشدار کمبود موجودی کیف پول</b>\n\n"+
						"👤 کاربر گرامی (<code>%s</code>)،\n"+
						"موجودی کیف پول شما به <b>%s تومان</b> کاهش یافته است.\n\n"+
						"💡 جهت جلوگیری از قطع خودکار سرویس‌ها، لطفاً نسبت به افزایش موجودی اقدام فرمایید.",
					target.panelUsername, formatCurrency(newBalance),
				)
				_ = tgClient.SendMessage(ctx, botToken, target.telegramID, alertText, depositOnlyKeyboard())
				RecordUserNotification(target.telegramID, "low_balance")
			}
		}

		// 5.2 Low Traffic Notification
		if notifyLowTraffic && dataLimit > 0 {
			remainingBytes := dataLimit - currentBytes
			remainingGB := float64(remainingBytes) / (1024.0 * 1024.0 * 1024.0)
			if remainingBytes > 0 && remainingGB <= lowTrafficThresholdGB {
				if CanSendUserNotification(target.telegramID, "low_traffic", 24) && tgClient != nil && botToken != "" {
					alertText := fmt.Sprintf(
						"📊 <b>هشدار حجم ترافیک باقی‌مانده</b>\n\n"+
							"👤 کاربر گرامی (<code>%s</code>)،\n"+
							"تنها <b>%.2f گیگابایت</b> از حجم ترافیک سرویس شما باقی مانده است.\n\n"+
							"⚡️ جهت تمدید یا ارتقای سرویس از منوی ربات اقدام فرمایید.",
						target.panelUsername, remainingGB,
					)
					_ = tgClient.SendMessage(ctx, botToken, target.telegramID, alertText, myPanelsKeyboard(true, target.subURL))
					RecordUserNotification(target.telegramID, "low_traffic")
				}
			}
		}

		// 5.3 Expiry / Renewal Time Warning
		if notifyExpiry && expire > 0 {
			nowUnix := time.Now().Unix()
			secondsLeft := expire - nowUnix
			hoursLeft := secondsLeft / 3600
			if secondsLeft > 0 && hoursLeft <= expiryThresholdHours {
				if CanSendUserNotification(target.telegramID, "expiry_warning", 24) && tgClient != nil && botToken != "" {
					alertText := fmt.Sprintf(
						"⏰ <b>هشدار زمان تمدید سرویس</b>\n\n"+
							"👤 کاربر گرامی (<code>%s</code>)،\n"+
							"تنها <b>%d ساعت</b> تا پایان مدت اعتبار سرویس شما باقی مانده است.\n\n"+
							"💡 جهت تمدید سرویس و جلوگیری از قطع شدن دسترسی، به منوی ربات مراجعه فرمایید.",
						target.panelUsername, hoursLeft,
					)
					_ = tgClient.SendMessage(ctx, botToken, target.telegramID, alertText, myPanelsKeyboard(true, target.subURL))
					RecordUserNotification(target.telegramID, "expiry_warning")
				}
			}
		}

		// 6. Handle Zero or Negative Balance
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

func sanitizeResellerPermissions(ctx context.Context, db *sql.DB) {
	rows, err := db.QueryContext(ctx, `SELECT id, permissions FROM admins WHERE role = 'reseller' AND status != 'deleted'`)
	if err != nil {
		return
	}
	defer rows.Close()

	type toUpdate struct {
		id    int64
		perms string
	}
	var list []toUpdate
	for rows.Next() {
		var id int64
		var raw sql.NullString
		if err := rows.Scan(&id, &raw); err == nil && raw.Valid && raw.String != "" {
			var p admin.AdminPermissions
			if err := json.Unmarshal([]byte(raw.String), &p); err == nil {
				if p.Sections.Hosts {
					p.Sections.Hosts = false
					newJSON, err := json.Marshal(p)
					if err == nil {
						list = append(list, toUpdate{id: id, perms: string(newJSON)})
					}
				}
			}
		}
	}
	_ = rows.Close()

	for _, item := range list {
		_, _ = db.ExecContext(ctx, `UPDATE admins SET permissions = ? WHERE id = ?`, item.perms, item.id)
	}
}

func assignConfiguredServicesToAdmin(ctx context.Context, db *sql.DB, adminID int64) {
	allowedRaw := strings.TrimSpace(GetSetting("allowed_services", ""))
	var serviceIDs []int64
	if allowedRaw != "" {
		parts := strings.Split(allowedRaw, ",")
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if id, err := strconv.ParseInt(p, 10, 64); err == nil && id > 0 {
				serviceIDs = append(serviceIDs, id)
			}
		}
	}

	// Fallback to all services if none configured
	if len(serviceIDs) == 0 {
		rows, err := db.QueryContext(ctx, `SELECT id FROM services`)
		if err != nil {
			return
		}
		defer rows.Close()

		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err == nil {
				serviceIDs = append(serviceIDs, id)
			}
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

// ChangeAdminPassword updates the password in both DarkPanel and SQLite
func ChangeAdminPassword(ctx context.Context, tgID int64, panelID int64, newRawPassword string) (*UserPanel, error) {
	newRawPassword = strings.TrimSpace(newRawPassword)
	if len(newRawPassword) < 6 {
		return nil, fmt.Errorf("کلمه عبور باید حداقل ۶ کاراکتر باشد")
	}

	panel, err := GetUserPanelByID(tgID, panelID)
	if err != nil || panel == nil {
		return nil, fmt.Errorf("پنل مورد نظر یافت نشد")
	}

	mainDB, _, err := GetMainDB()
	if err != nil {
		return nil, fmt.Errorf("خطا در برقراری ارتباط با دیتابیس پنل: %w", err)
	}

	hash, err := admin.HashPassword(newRawPassword)
	if err != nil {
		return nil, fmt.Errorf("خطا در پردازش کلمه عبور: %w", err)
	}

	_, err = mainDB.ExecContext(ctx, `
		UPDATE admins
		SET hashed_password = ?
		WHERE LOWER(username) = LOWER(?)
	`, hash, panel.PanelUsername)
	if err != nil {
		return nil, fmt.Errorf("خطا در بروزرسانی رمز عبور در سرور: %w", err)
	}

	_ = UpdateUserPanelPassword(tgID, panelID, newRawPassword)
	panel.PanelPassword = newRawPassword
	return panel, nil
}

// DeleteAdminPanel soft-deletes the admin account, its created users, and removes from bot database
func DeleteAdminPanel(ctx context.Context, tgID int64, panelID int64) (string, error) {
	panel, err := GetUserPanelByID(tgID, panelID)
	if err != nil || panel == nil {
		return "", fmt.Errorf("پنل مورد نظر یافت نشد")
	}

	mainDB, _, err := GetMainDB()
	if err == nil && mainDB != nil {
		var adminID int64
		_ = mainDB.QueryRowContext(ctx, `SELECT id FROM admins WHERE LOWER(username) = LOWER(?)`, panel.PanelUsername).Scan(&adminID)
		if adminID > 0 {
			// Delete users belonging to this admin
			_, _ = mainDB.ExecContext(ctx, `DELETE FROM users WHERE admin_id = ?`, adminID)
			_, _ = mainDB.ExecContext(ctx, `DELETE FROM admin_permissions WHERE admin_id = ?`, adminID)
			_, _ = mainDB.ExecContext(ctx, `DELETE FROM admin_services WHERE admin_id = ?`, adminID)
			_, _ = mainDB.ExecContext(ctx, `DELETE FROM admins WHERE id = ?`, adminID)
		}
	}

	// Remove usage tracking & reset test panel access so user can test again
	sqliteDB, _, err := GetDB()
	if err == nil && sqliteDB != nil {
		_, _ = sqliteDB.ExecContext(ctx, `DELETE FROM usage_tracking WHERE LOWER(panel_username) = LOWER(?)`, panel.PanelUsername)
		_, _ = sqliteDB.ExecContext(ctx, `UPDATE users SET has_used_test = 0 WHERE telegram_id = ?`, tgID)
	}

	_, _ = DeleteUserPanel(tgID, panelID)
	return panel.PanelUsername, nil
}

