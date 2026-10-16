package salesbot

import (
	"os"
	"path/filepath"
	"testing"
)

// TestMain isolates the bot database so tests never read or write real data.
func TestMain(m *testing.M) {
	dir, err := os.MkdirTemp("", "salesbot-test-*")
	if err == nil {
		_ = os.Setenv("BOT_DATABASE_PATH", filepath.Join(dir, "bot.db"))
		code := m.Run()
		_ = os.RemoveAll(dir)
		os.Exit(code)
	}
	os.Exit(m.Run())
}
