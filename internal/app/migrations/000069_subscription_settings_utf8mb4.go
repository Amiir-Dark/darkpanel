package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000069_subscription_settings_utf8mb4.go", up000069SubscriptionSettingsUTF8MB4, emptyDown)
}

// The subscription_settings table was originally created without an explicit
// character set, so on MySQL/MariaDB installs whose database default is latin1
// storing non-latin text (e.g. the Happ announcement/button text) failed with
// "Error 1366: Incorrect string value". Convert the table to utf8mb4.
func up000069SubscriptionSettingsUTF8MB4(ctx context.Context, tx *sql.Tx) error {
	if NormalizeDialect(activeDialect()) != "mysql" {
		return nil
	}
	hasTable, err := HasTable(ctx, tx, activeDialect(), "subscription_settings")
	if err != nil || !hasTable {
		return err
	}
	_, err = tx.ExecContext(ctx, "ALTER TABLE subscription_settings CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
	return err
}
