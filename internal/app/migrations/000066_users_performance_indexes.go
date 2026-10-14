package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000066_users_performance_indexes.go", up000066UsersPerformanceIndexes, emptyDown)
}

func up000066UsersPerformanceIndexes(ctx context.Context, tx *sql.Tx) error {
	dialect := activeDialect()

	indexes := []struct {
		table   string
		name    string
		columns []string
	}{
		{"users", "ix_users_status_created_id", []string{"status", "created_at", "id"}},
		{"users", "ix_users_created_id", []string{"created_at", "id"}},
		{"users", "ix_users_status_used_traffic", []string{"status", "used_traffic"}},
		{"user_online_ips", "ix_user_online_ips_seen_user", []string{"last_seen_at", "user_id"}},
		{"vpn_user_sessions", "ix_vpn_user_sessions_ended_seen", []string{"ended_at", "last_seen_at", "user_id"}},
		{"user_usage_logs", "ix_user_usage_logs_user_id", []string{"user_id"}},
		{"user_presence", "ix_user_presence_online_user", []string{"online_at", "user_id"}},
	}

	for _, idx := range indexes {
		_ = createIndexIfTableColumns(ctx, tx, dialect, idx.table, idx.name, idx.columns)
	}
	return nil
}
