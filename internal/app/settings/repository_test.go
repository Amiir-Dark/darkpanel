package settings

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

func TestReadTemplateContentIgnoresPersistentDirectoryWhenDBDirectoryIsEmpty(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if _, err := db.Exec(`CREATE TABLE subscription_settings (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		subscription_url_prefix TEXT NULL,
		subscription_profile_title TEXT NULL,
		subscription_support_url TEXT NULL,
		subscription_update_interval TEXT NULL,
		custom_templates_directory TEXT NULL,
		clash_subscription_template TEXT NULL,
		clash_settings_template TEXT NULL,
		subscription_page_template TEXT NULL,
		home_page_template TEXT NULL,
		v2ray_subscription_template TEXT NULL,
		v2ray_settings_template TEXT NULL,
		happ_subscription_template TEXT NULL,
		incy_subscription_template TEXT NULL,
		singbox_subscription_template TEXT NULL,
		singbox_settings_template TEXT NULL,
		mux_template TEXT NULL,
		client_routing_rules TEXT NULL,
		subscription_placeholder_enabled INTEGER NULL,
		subscription_placeholder_remark TEXT NULL,
		subscription_path TEXT NULL,
		subscription_aliases TEXT NULL,
		subscription_ports TEXT NULL,
		default_device_limit_type TEXT NULL,
		blocked_client_apps TEXT NULL,
		client_app_formats TEXT NULL,
		created_at DATETIME NULL,
		updated_at DATETIME NULL
	)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`CREATE TABLE user_subscription_access (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		user_agent TEXT NULL,
		updated_at DATETIME NULL
	)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`CREATE TABLE admins (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL,
		status TEXT NULL,
		subscription_domain TEXT NULL,
		subscription_settings TEXT NULL
	)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO subscription_settings (
		subscription_url_prefix,
		subscription_profile_title,
		subscription_support_url,
		subscription_update_interval,
		custom_templates_directory,
		clash_subscription_template,
		clash_settings_template,
		subscription_page_template,
		home_page_template,
		v2ray_subscription_template,
		v2ray_settings_template,
		happ_subscription_template,
		incy_subscription_template,
		singbox_subscription_template,
		singbox_settings_template,
		mux_template,
		subscription_placeholder_enabled,
		subscription_placeholder_remark,
		subscription_path,
		subscription_aliases,
		subscription_ports,
		client_routing_rules,
		blocked_client_apps,
		client_app_formats
	) VALUES (
		'', 'Subscription', 'https://t.me/', '12', NULL,
		'clash/default.yml', 'clash/settings.yml',
		'subscription/index.html', 'home/index.html',
		'v2ray/default.json', 'v2ray/settings.json',
		'v2ray/default.json', 'v2ray/default.json',
		'singbox/default.json', 'singbox/settings.json',
		'mux/default.json',
		0, 'disabled', 'sub', '[]', '[]', '` + defaultClientRoutingRules + `',
		'[]',
		'{}'
	)`); err != nil {
		t.Fatal(err)
	}

	dataDir := t.TempDir()
	t.Setenv("REBECCA_DATA_DIR", dataDir)
	staleTemplatePath := filepath.Join(dataDir, "templates", "subscription", "index.html")
	if err := os.MkdirAll(filepath.Dir(staleTemplatePath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(staleTemplatePath, []byte("persistent subscription template"), 0o644); err != nil {
		t.Fatal(err)
	}

	templateRoot := t.TempDir()
	t.Chdir(templateRoot)
	appTemplatePath := filepath.Join(templateRoot, "templates", "subscription", "index.html")
	if err := os.MkdirAll(filepath.Dir(appTemplatePath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(appTemplatePath, []byte("app subscription template"), 0o644); err != nil {
		t.Fatal(err)
	}

	content, err := NewRepository(db, "sqlite").ReadTemplateContent(context.Background(), "subscription_page_template", nil)
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(content.Content) != "app subscription template" {
		t.Fatalf("expected app template content, got %q", content.Content)
	}
	if content.ResolvedPath == nil || strings.TrimSpace(*content.ResolvedPath) == "" {
		t.Fatalf("expected a resolved path, got %#v", content.ResolvedPath)
	}
}

func TestReadTemplateContentRowTemplateFallback(t *testing.T) {
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "settings.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if _, err := db.Exec(`CREATE TABLE subscription_settings (
		id INTEGER PRIMARY KEY,
		clash_subscription_template TEXT NULL,
		clash_settings_template TEXT NULL,
		subscription_page_template TEXT NULL,
		home_page_template TEXT NULL,
		v2ray_subscription_template TEXT NULL,
		v2ray_settings_template TEXT NULL,
		happ_subscription_template TEXT NULL,
		incy_subscription_template TEXT NULL,
		singbox_subscription_template TEXT NULL,
		singbox_settings_template TEXT NULL,
		mux_template TEXT NULL,
		custom_templates_directory TEXT NULL,
		subscription_url_prefix TEXT NULL,
		subscription_profile_title TEXT NULL,
		subscription_support_url TEXT NULL,
		subscription_update_interval TEXT NULL,
		subscription_path TEXT NULL,
		subscription_aliases TEXT NULL,
		subscription_ports TEXT NULL,
		client_routing_rules TEXT NULL,
		subscription_placeholder_enabled INTEGER NULL,
		subscription_placeholder_remark TEXT NULL,
		happ_sub_info_color TEXT NULL,
		happ_sub_info_button_text TEXT NULL,
		happ_sub_info_button_link TEXT NULL,
		happ_sub_expire INTEGER NULL,
		happ_sub_expire_button_link TEXT NULL,
		default_device_limit_type TEXT NULL,
		blocked_client_apps TEXT NULL,
		client_app_formats TEXT NULL,
		created_at TIMESTAMP NULL,
		updated_at TIMESTAMP NULL
	);
	INSERT INTO subscription_settings (
		id, clash_subscription_template, clash_settings_template, subscription_page_template,
		home_page_template, v2ray_subscription_template, v2ray_settings_template,
		happ_subscription_template, incy_subscription_template, singbox_subscription_template,
		singbox_settings_template, mux_template
	) VALUES (
		1, '', '', 'subscription/row-template/arcade/shell.html',
		'', '', '', '', '', '', '', ''
	);
	CREATE TABLE admins (id INTEGER PRIMARY KEY, subscription_settings TEXT NULL);
	`); err != nil {
		t.Fatal(err)
	}

	repo := NewRepository(db, "sqlite")
	content, err := repo.ReadTemplateContent(context.Background(), "subscription_page_template", nil)
	if err != nil {
		t.Fatalf("ReadTemplateContent failed: %v", err)
	}
	if !strings.Contains(content.Content, "<!doctype html>") && !strings.Contains(content.Content, "<!DOCTYPE html>") {
		t.Fatalf("expected valid HTML template content, got: %s", content.Content[:min(100, len(content.Content))])
	}
}
