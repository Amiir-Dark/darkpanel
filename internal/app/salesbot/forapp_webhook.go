package salesbot

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	tomanRegex = regexp.MustCompile(`(?i)(?:واریز|مبلغ|انتقال)?[:\s]*([\d,]+)\s*(?:تومان|تمن)`)
	rialRegex  = regexp.MustCompile(`(?i)(?:واریز|مبلغ|انتقال)?[:\s]*([\d,]+)\s*(?:ریال)`)
	varizRegex = regexp.MustCompile(`(?i)(?:واریز|مبلغ|انتقال)[:\s]*([\d,]+)`)
	plusRegex  = regexp.MustCompile(`(?:\+|واریز\s*)\s*([\d,]{4,})\s*(?:ریال|تومان)?`)
	refRegex   = regexp.MustCompile(`(?i)(?:پیگیری|رهگیری|مرجع|ارجاع|کد\s*پیگیری)[:\s]*([0-9a-zA-Z]+)`)
)

type ForAppPayload struct {
	Test    bool   `json:"test"`
	Message string `json:"message"`
	Body    string `json:"body"`
	Text    string `json:"text"`
	Sender  string `json:"sender"`
	Bank    string `json:"bank"`
	Date    string `json:"date"`
}

func (s *Service) HandleForAppWebhook(w http.ResponseWriter, r *http.Request) {
	// Support GET for testing connectivity
	if r.Method == http.MethodGet {
		_ = RecordWebhookLog(WebhookLog{
			Sender:  r.RemoteAddr,
			Status:  "ready",
			Message: "بررسی اتصال وب‌هوک (GET) - سرور وب‌هوک فعال و آماده دریافت پیامک است",
		})
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"status":  "ready",
			"message": "وب‌هوک فوراپ فعال و آماده دریافت پیامک است",
		})
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		_ = RecordWebhookLog(WebhookLog{
			Sender:  r.RemoteAddr,
			Status:  "error",
			Message: "خطا در خواندن بدنه درخواست (Read Body Error)",
		})
		http.Error(w, `{"error":"failed to read body"}`, http.StatusBadRequest)
		return
	}

	secret := GetSetting("forapp_secret", "")
	if secret != "" {
		incomingSecret := r.Header.Get("X-Webhook-Secret")
		if incomingSecret == "" {
			authHeader := r.Header.Get("Authorization")
			incomingSecret = strings.TrimPrefix(authHeader, "Bearer ")
		}
		if incomingSecret != secret {
			_ = RecordWebhookLog(WebhookLog{
				Sender:     r.RemoteAddr,
				RawPayload: string(bodyBytes),
				Status:     "unauthorized",
				Message:    "کلید امنیتی وب‌هوک (Secret) نامعتبر بود و درخواست رد شد",
			})
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
	}

	var rawMap map[string]any
	_ = json.Unmarshal(bodyBytes, &rawMap)

	// Check if this is ForApp's test SMS ("test": true or "is_test": true)
	isTest := false
	if v, ok := rawMap["test"].(bool); ok && v {
		isTest = true
	}
	if v, ok := rawMap["is_test"].(bool); ok && v {
		isTest = true
	}

	var payload ForAppPayload
	_ = json.Unmarshal(bodyBytes, &payload)

	content := payload.Message
	if content == "" {
		content = payload.Body
	}
	if content == "" {
		content = payload.Text
	}

	if isTest || payload.Test {
		_ = RecordWebhookLog(WebhookLog{
			Sender:     payload.Sender,
			Bank:       payload.Bank,
			RawPayload: string(bodyBytes),
			SMSText:    content,
			Status:     "test",
			Message:    "پیامک تستی فوراپ با موفقیت دریافت شد (تست اتصال سبز است)",
		})
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"test":    true,
			"status":  "ok",
			"message": "پیامک تستی فوراپ با موفقیت دریافت شد",
		})
		return
	}

	if strings.TrimSpace(content) == "" {
		_ = RecordWebhookLog(WebhookLog{
			Sender:     payload.Sender,
			Bank:       payload.Bank,
			RawPayload: string(bodyBytes),
			Status:     "empty",
			Message:    "پیامک از فوراپ دریافت شد ولی متن آن خالی بود",
		})
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"status":  "received",
			"message": "message content is empty",
		})
		return
	}

	exactAmountToman, bankRef := extractPaymentDetails(content)
	if exactAmountToman <= 0 {
		_ = RecordWebhookLog(WebhookLog{
			Sender:     payload.Sender,
			Bank:       payload.Bank,
			RawPayload: string(bodyBytes),
			SMSText:    content,
			BankRef:    bankRef,
			Status:     "no_amount",
			Message:    "پیامک دریافت شد ولی هیچ مبلغ واریزی قابل تطبیقی در آن یافت نشد",
		})
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"matched": false,
			"message": "no amount extracted from sms",
		})
		return
	}

	db, _, err := GetDB()
	if err != nil {
		_ = RecordWebhookLog(WebhookLog{
			Sender:          payload.Sender,
			Bank:            payload.Bank,
			RawPayload:      string(bodyBytes),
			SMSText:         content,
			ExtractedAmount: exactAmountToman,
			BankRef:         bankRef,
			Status:          "error",
			Message:         "خطا در دسترسی به پایگاه داده ربات",
		})
		http.Error(w, `{"error":"database unavailable"}`, http.StatusInternalServerError)
		return
	}

	tx, err := db.Begin()
	if err != nil {
		http.Error(w, `{"error":"failed to begin transaction"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var orderID, userID int64
	var baseAmount float64
	err = tx.QueryRow(`
		SELECT id, user_id, amount_base 
		FROM orders 
		WHERE status = 'pending' AND expires_at > datetime('now') AND amount_exact = ?
		ORDER BY id DESC LIMIT 1`, exactAmountToman).Scan(&orderID, &userID, &baseAmount)

	if err != nil {
		// No matching order found
		_ = RecordWebhookLog(WebhookLog{
			Sender:          payload.Sender,
			Bank:            payload.Bank,
			RawPayload:      string(bodyBytes),
			SMSText:         content,
			ExtractedAmount: exactAmountToman,
			BankRef:         bankRef,
			Status:          "unmatched",
			Message:         fmt.Sprintf("مبلغ %s تومان شناسایی شد، اما سفارش ۵ دقیقه‌ای فعالی با این مبلغ وجود ندارد", formatCurrency(exactAmountToman)),
		})
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":           true,
			"matched":      false,
			"extracted_amt": exactAmountToman,
			"message":      "no active 5-minute order matching this exact amount",
		})
		return
	}

	if bankRef == "" {
		bankRef = fmt.Sprintf("auto_sms_%d", time.Now().Unix())
	}

	_, err = tx.Exec(`UPDATE orders SET status = 'paid', bank_ref = ? WHERE id = ?`, bankRef, orderID)
	if err != nil {
		http.Error(w, `{"error":"failed to update order"}`, http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(`
		UPDATE users 
		SET wallet_balance = wallet_balance + ?, total_spent = total_spent + ?
		WHERE telegram_id = ?`, exactAmountToman, exactAmountToman, userID)
	if err != nil {
		http.Error(w, `{"error":"failed to credit user wallet"}`, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, `{"error":"failed to commit transaction"}`, http.StatusInternalServerError)
		return
	}

	_ = RecordWebhookLog(WebhookLog{
		Sender:          payload.Sender,
		Bank:            payload.Bank,
		RawPayload:      string(bodyBytes),
		SMSText:         content,
		ExtractedAmount: exactAmountToman,
		BankRef:         bankRef,
		Matched:         true,
		OrderID:         &orderID,
		UserID:          &userID,
		Status:          "success",
		Message:         fmt.Sprintf("شارژ خودکار انجام شد! سفارش #%d کاربر %d با مبلغ %s تومان تایید و کیف پول شارژ گردید", orderID, userID, formatCurrency(exactAmountToman)),
	})

	// Send instant notification to the user via Telegram
	go func() {
		notifyCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		notifyText := fmt.Sprintf(
			"✅ <b>شارژ خودکار کیف پول انجام شد!</b>\n\n"+
				"واریز شما به مبلغ <b>%s تومان</b> از طریق پیامک بانک شناسایی و تایید گردید.\n"+
				"اعتبار به کیف پول شما اضافه شد و سرویس شما آماده استفاده است 🚀",
			formatCurrency(exactAmountToman),
		)
		_ = s.tgClient.SendMessage(notifyCtx, s.botToken, userID, notifyText, mainKeyboard())
	}()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":          true,
		"matched":     true,
		"order_id":    orderID,
		"user_id":     userID,
		"amount":      exactAmountToman,
		"bank_ref":    bankRef,
		"message":     "payment matched and wallet credited successfully",
	})
}

func extractPaymentDetails(sms string) (float64, string) {
	normalized := normalizeDigits(sms)

	var bankRef string
	if m := refRegex.FindStringSubmatch(normalized); len(m) > 1 {
		bankRef = m[1]
	}

	// 1. Check for "... ریال"
	if m := rialRegex.FindStringSubmatch(normalized); len(m) > 1 {
		val := cleanAndParse(m[1])
		if val > 0 {
			return val / 10, bankRef // Convert Rials to Tomans
		}
	}

	// 2. Check for "... تومان" or "... تمن"
	if m := tomanRegex.FindStringSubmatch(normalized); len(m) > 1 {
		val := cleanAndParse(m[1])
		if val > 0 {
			return val, bankRef
		}
	}

	// 3. Check for "واریز: 100,427" or "مبلغ: 100,427"
	if m := varizRegex.FindStringSubmatch(normalized); len(m) > 1 {
		val := cleanAndParse(m[1])
		if val > 0 {
			// If ends in 0 and looks like Rials (> 100000), check
			if val >= 100000 && int64(val)%10 == 0 {
				return val / 10, bankRef
			}
			return val, bankRef
		}
	}

	// 4. Check for "+100,427"
	if m := plusRegex.FindStringSubmatch(normalized); len(m) > 1 {
		val := cleanAndParse(m[1])
		if val > 0 {
			if strings.Contains(m[0], "ریال") || (val >= 100000 && int64(val)%10 == 0) {
				return val / 10, bankRef
			}
			return val, bankRef
		}
	}

	return 0, bankRef
}

func cleanAndParse(s string) float64 {
	clean := strings.ReplaceAll(s, ",", "")
	clean = strings.ReplaceAll(clean, "،", "")
	clean = strings.TrimSpace(clean)
	val, err := strconv.ParseFloat(clean, 64)
	if err != nil {
		return 0
	}
	return val
}
