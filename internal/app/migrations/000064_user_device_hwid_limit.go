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

	// 1. Add device_limit_type to users
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
