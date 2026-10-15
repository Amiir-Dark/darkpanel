package webhook

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"darkpanel-bot/config"
	"darkpanel-bot/database"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

func TestFormatMoney(t *testing.T) {
	cases := []struct {
		input    float64
		expected string
	}{
		{100000, "100,000"},
		{100347, "100,347"},
		{5000, "5,000"},
		{0, "0"},
		{12345678, "12,345,678"},
	}

	for _, c := range cases {
		actual := database.FormatMoney(c.input)
		if actual != c.expected {
			t.Errorf("FormatMoney(%.0f) = %s; want %s", c.input, actual, c.expected)
		}
	}
}

func TestForAppWebhookFlow(t *testing.T) {
	dbFile := "test_bot.db"
	defer os.Remove(dbFile)

	db, err := database.InitDB(dbFile)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	// 1. Create a test user
	user, err := db.CreateOrUpdateUser(999999, "testuser", "Test")
	if err != nil {
		t.Fatalf("CreateOrUpdateUser failed: %v", err)
	}
	if user.WalletBalance != 0 {
		t.Fatalf("Initial balance should be 0, got %f", user.WalletBalance)
	}

	// 2. Create 5-minute order for 100,000 Tomans with tail 347 (exact: 100,347)
	order, err := db.CreateOrder(user.TelegramID, 100000, 100347, "347", 5)
	if err != nil {
		t.Fatalf("CreateOrder failed: %v", err)
	}
	if order.Status != "pending" {
		t.Fatalf("Order status should be pending, got %s", order.Status)
	}

	// 3. Setup Webhook Server
	cfg := &config.Config{
		WebhookPort:   8085,
		WebhookPath:   "/webhook/forapp",
		WebhookSecret: "",
		AdminIDs:      []int64{123456},
	}
	// We create a dummy bot API (using a dummy token or mock)
	bot := &tgbotapi.BotAPI{}
	server := NewServer(cfg, db, nil, bot)

	// 4. Send ForApp JSON webhook with Rial amount (1,003,470 Rials = 100,347 Tomans)
	payload := ForAppPayload{
		ID:        "sms-12345",
		Test:      false,
		Sender:    "+989000000000",
		Bank:      "بانک ملت",
		Body:      "بانک ملت\nواریز: 1,003,470 ریال\nمانده: 5,000,000",
		Amount:    1003470,
		Code:      "470",
		Unit:      "rial",
		IsDeposit: boolPtr(true),
	}
	payloadBytes, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/webhook/forapp", bytes.NewReader(payloadBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.handleForApp(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status 200 OK, got %d", resp.StatusCode)
	}

	var resData map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&resData)
	if resData["status"] != "ok" {
		t.Fatalf("Expected status 'ok', got %v", resData)
	}

	// 5. Verify order is marked paid
	updatedOrder, err := db.GetOrder(order.ID)
	if err != nil || updatedOrder == nil {
		t.Fatalf("Failed to get updated order: %v", err)
	}
	if updatedOrder.Status != "paid" {
		t.Errorf("Order status should be 'paid', got '%s'", updatedOrder.Status)
	}

	// 6. Verify user wallet was credited with exact amount (100,347)
	updatedUser, _ := db.GetUser(user.TelegramID)
	if updatedUser.WalletBalance != 100347 {
		t.Errorf("Wallet balance should be 100347, got %f", updatedUser.WalletBalance)
	}
}

func TestForAppTestPing(t *testing.T) {
	dbFile := "test_bot_ping.db"
	defer os.Remove(dbFile)

	db, _ := database.InitDB(dbFile)
	defer db.Close()

	cfg := &config.Config{
		WebhookPort: 8085,
		WebhookPath: "/webhook/forapp",
	}
	bot := &tgbotapi.BotAPI{}
	server := NewServer(cfg, db, nil, bot)

	payload := ForAppPayload{
		Test:   true,
		Device: "Samsung S24",
		Bank:   "تست",
		Body:   "پیامک آزمایشی ForApp",
	}
	payloadBytes, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/webhook/forapp", bytes.NewReader(payloadBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.handleForApp(w, req)

	if w.Result().StatusCode != http.StatusOK {
		t.Fatalf("Expected 200 OK for test ping, got %d", w.Result().StatusCode)
	}
}

func TestOrderExpiration(t *testing.T) {
	dbFile := "test_bot_expiry.db"
	defer os.Remove(dbFile)

	db, err := database.InitDB(dbFile)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	// Create user
	user, err := db.CreateOrUpdateUser(777, "expiry_user", "Expiry")
	if err != nil {
		t.Fatalf("CreateOrUpdateUser failed: %v", err)
	}

	// Create order with -1 minute duration (already expired)
	order, err := db.CreateOrder(user.TelegramID, 50000, 50123, "123", -1)
	if err != nil {
		t.Fatalf("CreateOrder failed: %v", err)
	}

	// Check expired orders
	expired, err := db.GetExpiredPendingOrders()
	if err != nil {
		t.Fatalf("GetExpiredPendingOrders failed: %v", err)
	}
	if len(expired) == 0 {
		t.Fatalf("Expected at least 1 expired order, got 0")
	}

	// Mark expired
	err = db.MarkOrderExpired(order.ID)
	if err != nil {
		t.Fatalf("MarkOrderExpired failed: %v", err)
	}

	// Verify order status is expired
	o, _ := db.GetOrder(order.ID)
	if o.Status != "expired" {
		t.Errorf("Expected status 'expired', got '%s'", o.Status)
	}
}

func boolPtr(b bool) *bool {
	return &b
}
