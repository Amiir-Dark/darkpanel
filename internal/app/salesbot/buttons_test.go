package salesbot

import (
	"testing"
)

func kbTexts(kb InlineKeyboardMarkup) [][]string {
	out := make([][]string, 0, len(kb.InlineKeyboard))
	for _, row := range kb.InlineKeyboard {
		line := make([]string, 0, len(row))
		for _, b := range row {
			line = append(line, b.Text)
		}
		out = append(out, line)
	}
	return out
}

func assertKb(t *testing.T, kb InlineKeyboardMarkup, want [][]string) {
	t.Helper()
	got := kbTexts(kb)
	if len(got) != len(want) {
		t.Fatalf("row count mismatch: got %v want %v", got, want)
	}
	for i := range want {
		if len(got[i]) != len(want[i]) {
			t.Fatalf("row %d length mismatch: got %v want %v", i, got[i], want[i])
		}
		for j := range want[i] {
			if got[i][j] != want[i][j] {
				t.Fatalf("row %d col %d mismatch: got %q want %q", i, j, got[i][j], want[i][j])
			}
		}
	}
}

func TestMainKeyboardDefaultLayout(t *testing.T) {
	_ = SetSetting("kbd_main_menu", "")
	assertKb(t, mainKeyboard(), [][]string{
		{"⭐ دریافت پنل جدید"},
		{"🌐 پنل‌های من", "💳 موجودی"},
		{"🧪 دریافت پنل تست"},
		{"📮 پشتیبانی"},
	})
}

func TestBackKeyboardDefault(t *testing.T) {
	_ = SetSetting("kbd_back_menu", "")
	assertKb(t, backKeyboard(), [][]string{{"🔙 بازگشت به منو"}})
}

func TestPanelDetailBackLabel(t *testing.T) {
	_ = SetSetting("kbd_panel_detail", "")
	p := UserPanel{ID: 7, PanelURL: "https://panel.example.com"}
	single := panelDetailKeyboard(p, true, 1)
	multi := panelDetailKeyboard(p, true, 3)

	if got := single.InlineKeyboard[len(single.InlineKeyboard)-1][0].Text; got != "🔙 بازگشت به منو" {
		t.Fatalf("single panel back label = %q", got)
	}
	last := multi.InlineKeyboard[len(multi.InlineKeyboard)-1]
	if last[0].Text != "🔙 لیست پنل‌ها" || last[1].Text != "🏠 منوی اصلی" {
		t.Fatalf("multi panel last row = %v", []string{last[0].Text, last[1].Text})
	}
	if single.InlineKeyboard[0][0].URL != "https://panel.example.com" {
		t.Fatalf("open url button missing")
	}
}

func TestKeyboardOverrideReorderHideRelabel(t *testing.T) {
	_ = SetSetting("kbd_main_menu", `{"rows":[["support","buy_panel"]],"labels":{"buy_panel":"خرید"},"hidden":["wallet"]}`)
	defer SetSetting("kbd_main_menu", "")

	assertKb(t, mainKeyboard(), [][]string{
		{"📮 پشتیبانی", "خرید"},
		{"🌐 پنل‌های من"},
		{"🧪 دریافت پنل تست"},
	})
}

func TestDepositKeyboardHidesDisabledMethods(t *testing.T) {
	_ = SetSetting("kbd_deposit_menu", "")
	_ = SetSetting("deposit_5min_enabled", "false")
	_ = SetSetting("deposit_receipt_enabled", "true")
	_ = SetSetting("deposit_crypto_enabled", "false")
	defer func() {
		_ = SetSetting("deposit_5min_enabled", "true")
		_ = SetSetting("deposit_receipt_enabled", "true")
		_ = SetSetting("deposit_crypto_enabled", "true")
	}()

	kb := depositKeyboard()
	for _, row := range kb.InlineKeyboard {
		for _, b := range row {
			if b.CallbackData == "deposit_5min" || b.CallbackData == "deposit_crypto" {
				t.Fatalf("disabled method still present: %s", b.CallbackData)
			}
		}
	}
}

func TestPanelsListIncludesDynamicRows(t *testing.T) {
	_ = SetSetting("kbd_panels_list", "")
	panels := []UserPanel{
		{ID: 1, PanelUsername: "user1", Status: "active"},
		{ID: 2, PanelUsername: "user2", Status: "disabled"},
	}
	kb := panelsListKeyboard(panels, true)
	if len(kb.InlineKeyboard) != 4 {
		t.Fatalf("expected 4 rows, got %d: %v", len(kb.InlineKeyboard), kbTexts(kb))
	}
	if kb.InlineKeyboard[0][0].CallbackData != "view_panel:1" {
		t.Fatalf("unexpected first dynamic button: %+v", kb.InlineKeyboard[0][0])
	}
}
