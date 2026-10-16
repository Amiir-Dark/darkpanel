package salesbot

import "testing"

func TestBuildBroadcastKeyboard(t *testing.T) {
	if markup := buildBroadcastKeyboard(nil); markup != nil {
		t.Fatalf("expected nil markup for no buttons, got %#v", markup)
	}

	markup := buildBroadcastKeyboard([]BroadcastButton{
		{Text: "🏠 منوی اصلی", Action: "main_menu"},
		{Text: "کانال ما", URL: "https://t.me/example"},
	})
	keyboard, ok := markup.(InlineKeyboardMarkup)
	if !ok {
		t.Fatalf("expected InlineKeyboardMarkup, got %T", markup)
	}
	if len(keyboard.InlineKeyboard) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(keyboard.InlineKeyboard))
	}
	if got := keyboard.InlineKeyboard[0][0].CallbackData; got != "main_menu" {
		t.Fatalf("expected callback_data main_menu, got %q", got)
	}
	if got := keyboard.InlineKeyboard[1][0].URL; got != "https://t.me/example" {
		t.Fatalf("expected url button, got %q", got)
	}
}

func TestBuildBroadcastKeyboardSkipsInvalidEntries(t *testing.T) {
	markup := buildBroadcastKeyboard([]BroadcastButton{
		{Text: "  ", Action: "main_menu"},
		{Text: "بدون مقصد"},
		{Text: "کیف پول", Action: "wallet"},
	})
	keyboard, ok := markup.(InlineKeyboardMarkup)
	if !ok {
		t.Fatalf("expected InlineKeyboardMarkup, got %T", markup)
	}
	if len(keyboard.InlineKeyboard) != 1 {
		t.Fatalf("expected only 1 valid row, got %d", len(keyboard.InlineKeyboard))
	}
	if got := keyboard.InlineKeyboard[0][0].CallbackData; got != "wallet" {
		t.Fatalf("expected wallet callback, got %q", got)
	}
}
