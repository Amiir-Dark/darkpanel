package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000065_subscription_client_apps.go", up000065SubscriptionClientApps, emptyDown)
}

func up000065SubscriptionClientApps(ctx context.Context, tx *sql.Tx) error {
	dialect := activeDialect()
	columns := []struct {
		name   string
		sqlite string
		mysql  string
	}{
		{"blocked_client_apps", "TEXT NOT NULL DEFAULT '[]'", "TEXT NULL"},
	}

	for _, col := range columns {
		if err := addColumn(ctx, tx, dialect, "subscription_settings", col.name, col.sqlite, col.mysql); err != nil {
			return err
		}
	}
	if dialect == "mysql" || dialect == "mariadb" {
		_, _ = tx.ExecContext(ctx, "UPDATE subscription_settings SET blocked_client_apps = '[]' WHERE blocked_client_apps IS NULL")
	}
	return nil
}
