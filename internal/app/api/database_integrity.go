package api

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/rebeccapanel/rebecca/internal/app/logging"
	"github.com/rebeccapanel/rebecca/internal/app/migrations"
)

func checkDatabaseIntegrity(ctx context.Context, db *sql.DB) error {
	if db == nil {
		return fmt.Errorf("database is nil")
	}

	nodeCount, err := countRows(ctx, db, `SELECT COUNT(*) FROM nodes`)
	if err != nil {
		return err
	}
	operationCount, err := countRows(ctx, db, `SELECT COUNT(*) FROM node_operations`)
	if err != nil {
		return err
	}
	if nodeCount == 0 && operationCount > 0 {
		deleted, err := deleteRows(ctx, db, `DELETE FROM node_operations`)
		if err != nil {
			return fmt.Errorf("repair stale node operation queue: %w", err)
		}
		logging.Warnf(logging.ComponentDatabase, "integrity repair removed %d stale node operation rows because the nodes table is empty", deleted)
	}

	orphanOperations, err := countRows(ctx, db, `SELECT COUNT(*) FROM node_operations no LEFT JOIN nodes n ON n.id = no.node_id WHERE no.node_id IS NOT NULL AND n.id IS NULL`)
	if err != nil {
		return err
	}
	if orphanOperations > 0 {
		deleted, err := deleteRows(ctx, db, `DELETE FROM node_operations WHERE node_id IS NOT NULL AND node_id NOT IN (SELECT id FROM nodes)`)
		if err != nil {
			return fmt.Errorf("repair orphan node operations: %w", err)
		}
		logging.Warnf(logging.ComponentDatabase, "integrity repair removed %d node operation rows that referenced missing nodes", deleted)
	}

	orphanNodeUsages, err := countRows(ctx, db, `SELECT COUNT(*) FROM node_usages nu LEFT JOIN nodes n ON n.id = nu.node_id WHERE nu.node_id IS NOT NULL AND n.id IS NULL`)
	if err != nil {
		return err
	}
	if orphanNodeUsages > 0 {
		deleted, err := deleteRows(ctx, db, `DELETE FROM node_usages WHERE node_id IS NOT NULL AND node_id NOT IN (SELECT id FROM nodes)`)
		if err != nil {
			return fmt.Errorf("repair orphan node usages: %w", err)
		}
		logging.Warnf(logging.ComponentDatabase, "integrity repair removed %d node usage rows that referenced missing nodes", deleted)
	}

	orphanUserUsages, err := countRows(ctx, db, `SELECT COUNT(*) FROM node_user_usages nu LEFT JOIN nodes n ON n.id = nu.node_id WHERE nu.node_id IS NOT NULL AND n.id IS NULL`)
	if err != nil {
		return err
	}
	if orphanUserUsages > 0 {
		deleted, err := deleteRows(ctx, db, `DELETE FROM node_user_usages WHERE node_id IS NOT NULL AND node_id NOT IN (SELECT id FROM nodes)`)
		if err != nil {
			return fmt.Errorf("repair orphan node user usages: %w", err)
		}
		logging.Warnf(logging.ComponentDatabase, "integrity repair removed %d node user usage rows that referenced missing nodes", deleted)
	}

	if orphan, err := countRows(ctx, db, `SELECT COUNT(*) FROM users u LEFT JOIN services s ON s.id = u.service_id WHERE u.service_id IS NOT NULL AND s.id IS NULL`); err == nil && orphan > 0 {
		deleted, _ := deleteRows(ctx, db, `UPDATE users SET service_id = NULL WHERE service_id IS NOT NULL AND service_id NOT IN (SELECT id FROM services)`)
		logging.Warnf(logging.ComponentDatabase, "integrity repair reset service_id on %d users referencing missing services", deleted)
	}
	if orphan, err := countRows(ctx, db, `SELECT COUNT(*) FROM service_hosts sh LEFT JOIN hosts h ON h.id = sh.host_id WHERE h.id IS NULL`); err == nil && orphan > 0 {
		deleted, _ := deleteRows(ctx, db, `DELETE FROM service_hosts WHERE host_id NOT IN (SELECT id FROM hosts)`)
		logging.Warnf(logging.ComponentDatabase, "integrity repair removed %d service_hosts referencing missing hosts", deleted)
	}
	if orphan, err := countRows(ctx, db, `SELECT COUNT(*) FROM service_hosts sh LEFT JOIN services s ON s.id = sh.service_id WHERE s.id IS NULL`); err == nil && orphan > 0 {
		deleted, _ := deleteRows(ctx, db, `DELETE FROM service_hosts WHERE service_id NOT IN (SELECT id FROM services)`)
		logging.Warnf(logging.ComponentDatabase, "integrity repair removed %d service_hosts referencing missing services", deleted)
	}
	if orphan, err := countRows(ctx, db, `SELECT COUNT(*) FROM service_admins l LEFT JOIN admins a ON a.id = l.admin_id WHERE a.id IS NULL`); err == nil && orphan > 0 {
		deleted, _ := deleteRows(ctx, db, `DELETE FROM service_admins WHERE admin_id NOT IN (SELECT id FROM admins)`)
		logging.Warnf(logging.ComponentDatabase, "integrity repair removed %d service_admins referencing missing admins", deleted)
	}
	if orphan, err := countRows(ctx, db, `SELECT COUNT(*) FROM service_admins l LEFT JOIN services s ON s.id = l.service_id WHERE s.id IS NULL`); err == nil && orphan > 0 {
		deleted, _ := deleteRows(ctx, db, `DELETE FROM service_admins WHERE service_id NOT IN (SELECT id FROM services)`)
		logging.Warnf(logging.ComponentDatabase, "integrity repair removed %d service_admins referencing missing services", deleted)
	}

	_ = migrations.RepairMySQLMissingAutoIncrements(ctx, db, "mysql")

	return nil
}

func countRows(ctx context.Context, db *sql.DB, query string, args ...any) (int64, error) {
	var count int64
	if err := db.QueryRowContext(ctx, query, args...).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func deleteRows(ctx context.Context, db *sql.DB, query string, args ...any) (int64, error) {
	result, err := db.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return 0, nil
	}
	return count, nil
}
