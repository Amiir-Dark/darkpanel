package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000067_subscription_client_app_formats.go", up000067SubscriptionClientAppFormats, emptyDown)
}

func up000067SubscriptionClientAppFormats(ctx context.Context, tx *sql.Tx) error {
	dialect := activeDialect()
	if err := ensureSubscriptionSettingsTable(ctx, tx, dialect); err != nil {
		return err
	}
	columns := []struct {
		name   string
		sqlite string
		mysql  string
	}{
		{"client_app_formats", "TEXT NOT NULL DEFAULT '{}'", "TEXT NULL"},
	}

	for _, col := range columns {
		if err := addColumn(ctx, tx, dialect, "subscription_settings", col.name, col.sqlite, col.mysql); err != nil {
			return err
		}
	}
	if dialect == "mysql" || dialect == "mariadb" {
		_, _ = tx.ExecContext(ctx, "UPDATE subscription_settings SET client_app_formats = '{}' WHERE client_app_formats IS NULL")
	}
	return nil
}
