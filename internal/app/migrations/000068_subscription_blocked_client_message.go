package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000068_subscription_blocked_client_message.go", up000068SubscriptionBlockedClientMessage, emptyDown)
}

func up000068SubscriptionBlockedClientMessage(ctx context.Context, tx *sql.Tx) error {
	dialect := activeDialect()
	if err := ensureSubscriptionSettingsTable(ctx, tx, dialect); err != nil {
		return err
	}
	columns := []struct {
		name   string
		sqlite string
		mysql  string
	}{
		{"blocked_client_message", "TEXT NOT NULL DEFAULT ''", "TEXT NULL"},
	}

	for _, col := range columns {
		if err := addColumn(ctx, tx, dialect, "subscription_settings", col.name, col.sqlite, col.mysql); err != nil {
			return err
		}
	}
	if dialect == "mysql" || dialect == "mariadb" {
		_, _ = tx.ExecContext(ctx, "UPDATE subscription_settings SET blocked_client_message = '' WHERE blocked_client_message IS NULL")
	}
	return nil
}
