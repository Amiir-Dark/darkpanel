package migrations

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000064_user_device_hwid_limit.go", up000064UserDeviceHWIDLimit, emptyDown)
}

func up000064UserDeviceHWIDLimit(ctx context.Context, tx *sql.Tx) error {
	dialect := activeDialect()

	// 1. Ensure users table exists
	if err := ensureUsersTable(ctx, tx, dialect); err != nil {
		return err
	}

	// 2. Add device_limit_type to users
	if err := addColumn(ctx, tx, dialect, "users", "device_limit_type", "VARCHAR(16) NOT NULL DEFAULT 'ip'", "VARCHAR(16) NOT NULL DEFAULT 'ip'"); err != nil {
		return err
	}

	// 2. Add default_device_limit_type to subscription_settings
	if err := ensureSubscriptionSettingsTable(ctx, tx, dialect); err != nil {
		return err
	}
	if err := addColumn(ctx, tx, dialect, "subscription_settings", "default_device_limit_type", "VARCHAR(16) NOT NULL DEFAULT 'ip'", "VARCHAR(16) NOT NULL DEFAULT 'ip'"); err != nil {
		return err
	}

	// 3. Create user_hwids table
	sqliteSQL := `CREATE TABLE user_hwids (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		hwid VARCHAR(128) NOT NULL,
		user_agent TEXT NOT NULL DEFAULT '',
		last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	)`

	userColType := "INTEGER"
	if dialect == "mysql" || dialect == "mariadb" {
		_ = tx.QueryRowContext(ctx, "SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'id'").Scan(&userColType)
		if userColType == "" {
			userColType = "INTEGER"
		}
	}

	mysqlSQL := fmt.Sprintf(`CREATE TABLE user_hwids (
		id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY,
		user_id %s NOT NULL,
		hwid VARCHAR(128) NOT NULL,
		user_agent TEXT NULL,
		last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, userColType)

	if err := createTable(ctx, tx, dialect, "user_hwids", sqliteSQL, mysqlSQL); err != nil {
		return err
	}

	if dialect == "mysql" || dialect == "mariadb" {
		_, _ = tx.ExecContext(ctx, `ALTER TABLE user_hwids ADD CONSTRAINT fk_user_hwids_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE`)
	}

	if err := createIndex(ctx, tx, dialect, "user_hwids", "uq_user_hwids_user_hwid", []string{"user_id", "hwid"}, true); err != nil {
		return err
	}

	if err := createIndex(ctx, tx, dialect, "user_hwids", "idx_user_hwids_user_id", []string{"user_id"}, false); err != nil {
		return err
	}

	if err := createIndex(ctx, tx, dialect, "user_hwids", "idx_user_hwids_last_seen", []string{"last_seen_at"}, false); err != nil {
		return err
	}

	return nil
}

func ensureUsersTable(ctx context.Context, tx *sql.Tx, dialect string) error {
	hasUsers, err := HasTable(ctx, tx, dialect, "users")
	if err != nil {
		return err
	}
	if hasUsers {
		return nil
	}

	hasAdmins, err := HasTable(ctx, tx, dialect, "admins")
	if err != nil {
		return err
	}
	if !hasAdmins {
		if err := createTable(ctx, tx, dialect, "admins", `
CREATE TABLE admins (
	id INTEGER PRIMARY KEY,
	username VARCHAR(34),
	hashed_password VARCHAR(128),
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	role VARCHAR(32) NOT NULL DEFAULT 'standard',
	permissions TEXT NULL,
	password_reset_at DATETIME NULL,
	telegram_id BIGINT NULL,
	subscription_domain VARCHAR(255) NULL,
	subscription_settings TEXT NULL,
	users_usage BIGINT NOT NULL DEFAULT 0,
	lifetime_usage BIGINT NOT NULL DEFAULT 0,
	created_traffic BIGINT NOT NULL DEFAULT 0,
	deleted_users_usage BIGINT NOT NULL DEFAULT 0,
	data_limit BIGINT NULL,
	traffic_limit_mode VARCHAR(15) NOT NULL DEFAULT 'used_traffic',
	use_service_traffic_limits INTEGER NOT NULL DEFAULT 0,
	show_user_traffic INTEGER NOT NULL DEFAULT 1,
	delete_user_usage_limit_enabled INTEGER NOT NULL DEFAULT 0,
	delete_user_usage_limit BIGINT NULL,
	expire INTEGER NULL,
	users_limit INTEGER NULL,
	status VARCHAR(32) NOT NULL DEFAULT 'active',
	disabled_reason VARCHAR(512) NULL
)`, `
CREATE TABLE admins (
	id INTEGER NOT NULL AUTO_INCREMENT,
	username VARCHAR(34),
	hashed_password VARCHAR(128),
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	role VARCHAR(32) NOT NULL DEFAULT 'standard',
	permissions JSON NULL,
	password_reset_at DATETIME NULL,
	telegram_id BIGINT NULL,
	subscription_domain VARCHAR(255) NULL,
	subscription_settings JSON NULL,
	users_usage BIGINT NOT NULL DEFAULT 0,
	lifetime_usage BIGINT NOT NULL DEFAULT 0,
	created_traffic BIGINT NOT NULL DEFAULT 0,
	deleted_users_usage BIGINT NOT NULL DEFAULT 0,
	data_limit BIGINT NULL,
	traffic_limit_mode VARCHAR(15) NOT NULL DEFAULT 'used_traffic',
	use_service_traffic_limits BOOLEAN NOT NULL DEFAULT 0,
	show_user_traffic BOOLEAN NOT NULL DEFAULT 1,
	delete_user_usage_limit_enabled BOOLEAN NOT NULL DEFAULT 0,
	delete_user_usage_limit BIGINT NULL,
	expire INTEGER NULL,
	users_limit INTEGER NULL,
	status VARCHAR(32) NOT NULL DEFAULT 'active',
	disabled_reason VARCHAR(512) NULL,
	PRIMARY KEY (id)
)`); err != nil {
			return err
		}
	}

	adminColType := "INTEGER"
	if dialect == "mysql" || dialect == "mariadb" {
		_ = tx.QueryRowContext(ctx, "SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'admins' AND column_name = 'id'").Scan(&adminColType)
		if adminColType == "" {
			adminColType = "INTEGER"
		}
	}

	sqliteSQL := `CREATE TABLE users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username VARCHAR(34) COLLATE NOCASE,
	credential_key VARCHAR(64) NULL,
	subscription_token VARCHAR(255) NOT NULL DEFAULT '',
	flow VARCHAR(128) NULL,
	status VARCHAR(32) NOT NULL DEFAULT 'active',
	used_traffic BIGINT DEFAULT 0,
	data_limit BIGINT NULL,
	data_limit_reset_strategy VARCHAR(32) NOT NULL DEFAULT 'no_reset',
	expire INTEGER NULL,
	admin_id INTEGER NULL,
	sub_revoked_at DATETIME NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	note VARCHAR(500) NULL,
	telegram_id VARCHAR(128) NULL,
	contact_number VARCHAR(64) NULL,
	ip_limit INTEGER NOT NULL DEFAULT 0,
	auto_delete_in_days INTEGER NULL,
	edit_at DATETIME NULL,
	last_status_change DATETIME NULL,
	admin_disabled_at DATETIME NULL,
	service_limit_disabled_at DATETIME NULL,
	FOREIGN KEY(admin_id) REFERENCES admins(id)
)`

	mysqlSQL := fmt.Sprintf(`CREATE TABLE users (
	id INTEGER NOT NULL AUTO_INCREMENT,
	username VARCHAR(34),
	credential_key VARCHAR(64) NULL,
	subscription_token VARCHAR(255) NOT NULL DEFAULT '',
	flow VARCHAR(128) NULL,
	status VARCHAR(32) NOT NULL DEFAULT 'active',
	used_traffic BIGINT DEFAULT 0,
	data_limit BIGINT NULL,
	data_limit_reset_strategy VARCHAR(32) NOT NULL DEFAULT 'no_reset',
	expire INTEGER NULL,
	admin_id %s NULL,
	sub_revoked_at DATETIME NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	note VARCHAR(500) NULL,
	telegram_id VARCHAR(128) NULL,
	contact_number VARCHAR(64) NULL,
	ip_limit INTEGER NOT NULL DEFAULT 0,
	auto_delete_in_days INTEGER NULL,
	edit_at DATETIME NULL,
	last_status_change DATETIME NULL,
	admin_disabled_at DATETIME NULL,
	service_limit_disabled_at DATETIME NULL,
	PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`, adminColType)

	if err := createTable(ctx, tx, dialect, "users", sqliteSQL, mysqlSQL); err != nil {
		return err
	}

	if dialect == "mysql" || dialect == "mariadb" {
		_, _ = tx.ExecContext(ctx, `ALTER TABLE users ADD CONSTRAINT fk_users_admin_id_admins FOREIGN KEY (admin_id) REFERENCES admins (id)`)
	}

	_ = createIndex(ctx, tx, dialect, "users", "ix_users_username", []string{"username"}, false)
	_ = createIndex(ctx, tx, dialect, "users", "ix_users_subscription_token", []string{"subscription_token"}, false)
	return nil
}

