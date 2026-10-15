package salesbot

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	tomanRegex = regexp.MustCompile(`(?i)([\d,]+)\s*(?:تومان|تمن)`)
	rialRegex  = regexp.MustCompile(`(?i)([\d,]+)\s*(?:ریال)`)
	varizRegex = regexp.MustCompile(`(?i)واریز[:\s]*([\d,]+)`)
	refRegex   = regexp.MustCompile(`(?i)(?:پیگیری|رهگیری|مرجع|ارجاع)[:\s]*([0-9a-zA-Z]+)`)
)

type ForAppPayload struct {
	Message string `json:"message"`
	Body    string `json:"body"`
	Text    string `json:"text"`
	Sender  string `json:"sender"`
	Bank    string `json:"bank"`
	Date    string `json:"date"`
}

func (s *Service) handleForAppWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
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
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
	}

	var payload ForAppPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid json body"}`, http.StatusBadRequest)
		return
	}

	content := payload.Message
	if content == "" {
		content = payload.Body
	}
	if content == "" {
		content = payload.Text
	}

	if strings.TrimSpace(content) == "" {
		http.Error(w, `{"error":"message content is empty"}`, http.StatusBadRequest)
		return
	}

	exactAmountToman, bankRef := extractPaymentDetails(content)
	if exactAmountToman <= 0 {
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

	// Check for Tomans
	if m := tomanRegex.FindStringSubmatch(normalized); len(m) > 1 {
		val := cleanAndParse(m[1])
		if val > 0 {
			return val, bankRef
		}
	}

	// Check for Rials
	if m := rialRegex.FindStringSubmatch(normalized); len(m) > 1 {
		val := cleanAndParse(m[1])
		if val > 0 {
			return val / 10, bankRef // Convert Rials to Tomans
		}
	}

	// Check for "واریز: 100,427"
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
