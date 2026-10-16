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
	got := getBotMessage("wallet", "5,000")
	if !strings.Contains(got, "5,000") {
		t.Fatalf("expected formatted default, got %q", got)
	}
	if !strings.Contains(got, "کیف پول شما") {
		t.Fatalf("expected wallet default content, got %q", got)
	}
}

func TestSafeSprintfFallsBackOnMismatch(t *testing.T) {
	tpl := "hello %s"
	if got := safeSprintf(tpl, 1, 2); got != tpl {
		t.Fatalf("expected raw template on mismatch, got %q", got)
	}
	if got := safeSprintf("hi %s", "ali"); got != "hi ali" {
		t.Fatalf("expected formatted output, got %q", got)
	}
}
