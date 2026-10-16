package salesbot

import (
	"strings"
	"testing"
)

func TestBotMessageRegistryIntegrity(t *testing.T) {
	seen := map[string]bool{}
	for _, def := range botMessageRegistry {
		if strings.TrimSpace(def.Key) == "" {
			t.Fatalf("message with empty key: %#v", def)
		}
		if seen[def.Key] {
			t.Fatalf("duplicate message key: %s", def.Key)
		}
		seen[def.Key] = true
		if strings.TrimSpace(def.Default) == "" {
			t.Fatalf("message %s has empty default", def.Key)
		}
		if _, ok := botMessageSectionTitles[def.Section]; !ok {
			t.Fatalf("message %s references unknown section %q", def.Key, def.Section)
		}
	}
}

func TestGetBotMessageFallsBackToDefault(t *testing.T) {
	got := getBotMessage("wallet", map[string]string{"balance": "5,000"})
	if !strings.Contains(got, "5,000") {
		t.Fatalf("expected rendered balance, got %q", got)
	}
	if strings.Contains(got, "{{balance}}") {
		t.Fatalf("expected placeholders to be replaced, got %q", got)
	}
}

func TestRenderTemplate(t *testing.T) {
	vars := map[string]string{"name": "علی", "brand": "zonix"}
	if got := RenderTemplate("سلام {{name}} از {{ brand }}", vars); got != "سلام علی از zonix" {
		t.Fatalf("unexpected render: %q", got)
	}
	if got := RenderTemplate("{{unknown}}", vars); got != "{{unknown}}" {
		t.Fatalf("unknown placeholder should be preserved, got %q", got)
	}
	if got := RenderTemplate("بدون متغیر", vars); got != "بدون متغیر" {
		t.Fatalf("unexpected render: %q", got)
	}
}

func TestBotVariableCatalogKeys(t *testing.T) {
	for _, item := range botVariableCatalog {
		if strings.TrimSpace(item["key"]) == "" || strings.TrimSpace(item["label"]) == "" {
			t.Fatalf("invalid variable catalog entry: %#v", item)
		}
	}
}
