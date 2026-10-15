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
