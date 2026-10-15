package webhook

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"darkpanel-bot/client"
	"darkpanel-bot/config"
	"darkpanel-bot/database"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

type Server struct {
	cfg         *config.Config
	db          *database.DB
	panelClient *client.PanelClient
	bot         *tgbotapi.BotAPI
	httpServer  *http.Server
}

func NewServer(cfg *config.Config, db *database.DB, panelClient *client.PanelClient, bot *tgbotapi.BotAPI) *Server {
	return &Server{
		cfg:         cfg,
		db:          db,
		panelClient: panelClient,
		bot:         bot,
	}
}

// ForAppPayload matches the JSON sent by erfjab/forapp Android app
type ForAppPayload struct {
	ID           interface{} `json:"id"`
	Test         bool        `json:"test"`
	Sender       string      `json:"sender"`
	Bank         string      `json:"bank"`
	Body         string      `json:"body"`
	Amount       interface{} `json:"amount"` // float64, int64 or string
	Code         string      `json:"code"`   // 3-digit tail code
	Unit         string      `json:"unit"`   // "rial" or "toman"
	IsDeposit    *bool       `json:"is_deposit"`
	ReceivedAt   string      `json:"received_at"`
	ReceivedAtMS int64       `json:"received_at_ms"`
	Attempt      int         `json:"attempt"`
	Device       string      `json:"device"`
}

func (s *Server) Start(ctx context.Context) {
	mux := http.NewServeMux()

	mux.HandleFunc("/", s.handleHealth)
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/webhook/forapp", s.handleForApp)
	mux.HandleFunc("/webhook/sms", s.handleForApp)
	mux.HandleFunc("/forapp", s.handleForApp)

	addr := fmt.Sprintf(":%d", s.cfg.WebhookPort)
	s.httpServer = &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	go func() {
		<-ctx.Done()
		log.Println("[Webhook] Shutting down ForApp HTTP webhook server...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = s.httpServer.Shutdown(shutdownCtx)
	}()

	log.Printf("[Webhook] ForApp SMS Webhook server listening on http://0.0.0.0:%d (endpoints: /webhook/forapp, /webhook/sms)", s.cfg.WebhookPort)
	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("[Webhook] HTTP server listen error: %v", err)
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "ok",
		"service":   "DarkPanel ForApp Webhook",
		"timestamp": time.Now().Format(time.RFC3339),
		"port":      s.cfg.WebhookPort,
	})
}

func (s *Server) handleForApp(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed. Use POST."})
		return
	}

	// Verify X-API-Key if configured
	if s.cfg.WebhookSecret != "" {
		apiKey := r.Header.Get("X-API-Key")
		if apiKey == "" {
			apiKey = r.URL.Query().Get("key")
		}
		if apiKey != s.cfg.WebhookSecret {
			log.Printf("[Webhook] Unauthorized request from %s (invalid X-API-Key)", r.RemoteAddr)
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "Unauthorized: invalid API key"})
			return
		}
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Failed to read request body"})
		return
	}
	defer r.Body.Close()

	var payload ForAppPayload
	// Try parsing JSON
	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		// Try parsing form urlencoded if not pure JSON
		bodyStr := string(bodyBytes)
		log.Printf("[Webhook] Non-standard payload received, attempting raw text parse: %s", bodyStr)
		payload.Body = bodyStr
	}

	// 1. Handle ForApp Test Ping ("ارسال آزمایشی")
	if payload.Test {
		log.Printf("[Webhook] Received test ping from ForApp (Device: %s, Bank: %s)", payload.Device, payload.Bank)
		s.notifyAdmins(fmt.Sprintf(
			"🔔 *پیامک آزمایشی ForApp دریافت شد*\n\n"+
				"✅ اتصال اپلیکیشن با وب‌هوک سرور برقرار است!\n"+
				"📱 دستگاه: `%s`\n"+
				"🏦 بانک: %s\n"+
				"💬 متن پیامک آزمایشی:\n`%s`",
			payload.Device, payload.Bank, payload.Body,
		))

		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "ok",
			"message": "اتصال ForApp با موفقیت تایید شد",
			"test":    true,
		})
		return
	}

	// 2. Check if this is a deposit
	isDeposit := true
	if payload.IsDeposit != nil {
		isDeposit = *payload.IsDeposit
	} else if payload.Body != "" {
		isDeposit = isDepositText(payload.Body)
	}

	if !isDeposit {
		log.Printf("[Webhook] Ignored non-deposit SMS from %s (%s)", payload.Sender, payload.Bank)
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "ignored",
			"message": "Transaction is not a deposit",
		})
		return
	}

	// 3. Extract and normalize Toman amount
	amountToman := s.extractTomanAmount(&payload)
	if amountToman <= 0 {
		log.Printf("[Webhook] Could not extract valid deposit amount from SMS: %s", payload.Body)
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "ignored",
			"message": "No valid amount extracted",
		})
		return
	}

	log.Printf("[Webhook] Parsed bank deposit: %.0f Tomans (Bank: %s, Sender: %s, Code: %s)",
		amountToman, payload.Bank, payload.Sender, payload.Code)

	// 4. Match active pending order in 5-minute window
	order, err := s.db.GetPendingOrderByExactAmount(amountToman)
	if err != nil {
		log.Printf("[Webhook] Database error querying order by exact amount: %v", err)
	}

	// Secondary match: if exact match didn't find, try matching by base amount and 3-digit code
	if order == nil && payload.Code != "" {
		baseAmount := float64(int64(amountToman/1000) * 1000)
		order, _ = s.db.GetPendingOrderByCode(baseAmount, payload.Code)
	}

	// 5. If Order Matched: Approve and Credit User!
	if order != nil {
		log.Printf("[Webhook] MATCH FOUND! Order #%d for User %d (Amount: %.0f Tomans)",
			order.ID, order.UserID, order.AmountExact)

		// Mark order as paid
		bankRef := fmt.Sprintf("%s (%s)", payload.Bank, payload.Sender)
		if bankRef == " ()" {
			bankRef = "SMS Gateway"
		}
		if err := s.db.MarkOrderPaid(order.ID, bankRef); err != nil {
			log.Printf("[Webhook] Error marking order #%d as paid: %v", order.ID, err)
		}

		// Credit user wallet
		newBalance, err := s.db.UpdateWallet(order.UserID, order.AmountExact)
		if err != nil {
			log.Printf("[Webhook] Error updating wallet for user %d: %v", order.UserID, err)
		}

		// Clear user state if they were waiting for payment
		wState, _ := s.db.GetUserState(order.UserID)
		if wState == "waiting_auto_pay" {
			s.db.ClearUserState(order.UserID)
		}

		// Auto-reactivate user service if suspended/disabled
		user, _ := s.db.GetUser(order.UserID)
		if user != nil && user.PanelUsername != "" && (user.ServiceStatus == "disabled" || user.ServiceStatus == "suspended") {
			if s.panelClient != nil {
				_ = s.panelClient.SetUserStatus(context.Background(), user.PanelUsername, "active")
			}
			_ = s.db.UpdateServiceStateOnly(order.UserID, "active")
			log.Printf("[Webhook] Reactivated service for user %s (%d)", user.PanelUsername, order.UserID)
		}

		// Send celebratory confirmation to User in Telegram
		userMsg := fmt.Sprintf(
			"🎉 *پرداخت شما با موفقیت تایید و کیف پول شارژ شد!*\n\n"+
				"💰 *مبلغ واریز شده:* `%s` تومان\n"+
				"💳 *موجودی جدید کیف پول:* `%s` تومان\n"+
				"🏦 *درگاه واریز:* %s\n\n"+
				"⚡️ سرویس شما فعال بوده و هزینه مصرفی به صورت لحظه‌ای از موجودی کسر می‌گردد.",
			database.FormatMoney(order.AmountExact),
			database.FormatMoney(newBalance),
			bankRef,
		)
		m := tgbotapi.NewMessage(order.UserID, userMsg)
		m.ParseMode = tgbotapi.ModeMarkdown
		_, _ = s.bot.Send(m)

		// Notify Admins in Telegram
		userName := ""
		if user != nil {
			if user.Username != "" {
				userName = "@" + user.Username
			} else {
				userName = user.FirstName
			}
		}

		adminAlert := fmt.Sprintf(
			"✅ *واریز کارت به کارت تایید خودکار شد (ForApp)*\n\n"+
				"🆔 شناسه سفارش: `#%d`\n"+
				"👤 کاربر: %s\n"+
				"🔢 تلگرام آیدی: `%d`\n"+
				"💰 مبلغ شارژ شده: *%s* تومان\n"+
				"💳 موجودی جدید: *%s* تومان\n"+
				"🏦 بانک: %s\n"+
				"📱 فرستنده: %s\n"+
				"⏰ زمان پیامک: %s\n\n"+
				"💬 *متن پیامک بانک:*\n`%s`",
			order.ID, userName, order.UserID,
			database.FormatMoney(order.AmountExact),
			database.FormatMoney(newBalance),
			payload.Bank, payload.Sender,
			time.Now().Format("15:04:05 - 2006/01/02"),
			payload.Body,
		)
		s.notifyAdmins(adminAlert)

		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":   "ok",
			"order_id": order.ID,
			"user_id":  order.UserID,
			"credited": order.AmountExact,
			"balance":  newBalance,
		})
		return
	}

	// 6. No matching active pending order found
	log.Printf("[Webhook] No matching active 5-minute pending order found for amount %.0f Tomans", amountToman)

	// Notify admins so they can review if someone paid with delay
	adminAlert := fmt.Sprintf(
		"⚠️ *پیامک واریز بدون سفارش معتبر (ForApp)*\n\n"+
			"💰 مبلغ شناسایی شده: *%s* تومان\n"+
			"🏦 بانک: %s\n"+
			"📱 فرستنده: %s\n\n"+
			"💬 *متن پیامک بانک:*\n`%s`\n\n"+
			"📌 *توضیح:* هیچ سفارش بازی با این مبلغ دقیق در مهلت ۵ دقیقه گذشته یافت نشد (احتمالاً کاربر پس از پایان مهلت واریز کرده یا مستقیماً کارت به کارت کرده است). در صورت پیگیری کاربر، می‌توانید دستی تایید کنید.",
		database.FormatMoney(amountToman),
		payload.Bank, payload.Sender, payload.Body,
	)
	s.notifyAdmins(adminAlert)

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "ignored",
		"message": "No matching active pending order",
		"parsed":  amountToman,
	})
}

// extractTomanAmount extracts and converts amount to Tomans
func (s *Server) extractTomanAmount(p *ForAppPayload) float64 {
	var rawAmount float64

	switch v := p.Amount.(type) {
	case float64:
		rawAmount = v
	case int64:
		rawAmount = float64(v)
	case int:
		rawAmount = float64(v)
	case string:
		clean := strings.ReplaceAll(v, ",", "")
		clean = strings.ReplaceAll(clean, "٬", "")
		clean = strings.ReplaceAll(clean, "،", "")
		clean = normalizePersianDigits(clean)
		if f, err := strconv.ParseFloat(clean, 64); err == nil {
			rawAmount = f
		}
	case json.Number:
		if f, err := v.Float64(); err == nil {
			rawAmount = f
		}
	}

	unit := strings.ToLower(strings.TrimSpace(p.Unit))

	// If rawAmount > 0, convert by unit
	if rawAmount > 0 {
		if unit == "rial" || unit == "irr" || unit == "ریال" {
			return rawAmount / 10
		}
		if unit == "toman" || unit == "تومان" {
			return rawAmount
		}

		// Unit not specified: Iranian bank SMS usually has Rial (e.g. 1,000,000 Rials = 100,000 Tomans)
		// Check if an order matches directly as Toman
		if s.db.IsExactAmountTaken(rawAmount) {
			return rawAmount
		}
		// Check if matches as Rial / 10
		if rawAmount >= 100000 && s.db.IsExactAmountTaken(rawAmount/10) {
			return rawAmount / 10
		}
		return rawAmount
	}

	// If amount in JSON was missing or 0, parse body regex
	if p.Body != "" {
		return parseAmountFromText(p.Body)
	}

	return 0
}

func (s *Server) notifyAdmins(text string) {
	for _, adminID := range s.cfg.AdminIDs {
		msg := tgbotapi.NewMessage(adminID, text)
		msg.ParseMode = tgbotapi.ModeMarkdown
		_, _ = s.bot.Send(msg)
	}
}

// isDepositText checks whether the SMS indicates a deposit
func isDepositText(body string) bool {
	norm := normalizePersianDigits(body)
	depositWords := []string{"واریز", "انتقال به", "بستانکار", "دریافت وجه", "+"}
	withdrawWords := []string{"برداشت", "خرید", "کسر", "انتقال از", "بدهکار", "-"}

	for _, w := range withdrawWords {
		if strings.Contains(norm, w) {
			return false
		}
	}
	for _, d := range depositWords {
		if strings.Contains(norm, d) {
			return true
		}
	}
	return true
}

var numRegex = regexp.MustCompile(`\d{1,3}(?:[,\x{066C}\x{060C}]\d{3})+|\d{4,}`)

// parseAmountFromText extracts the deposit amount directly from raw SMS body
func parseAmountFromText(body string) float64 {
	norm := normalizePersianDigits(body)
	norm = strings.ReplaceAll(norm, "٬", ",")
	norm = strings.ReplaceAll(norm, "،", ",")

	matches := numRegex.FindAllString(norm, -1)
	if len(matches) == 0 {
		return 0
	}

	isRial := strings.Contains(norm, "ریال") || strings.Contains(strings.ToLower(norm), "rial") || strings.Contains(norm, "irr")

	// Filter out card numbers or long numbers (> 12 digits)
	for _, match := range matches {
		clean := strings.ReplaceAll(match, ",", "")
		if len(clean) > 11 {
			continue // likely card or reference number
		}
		val, err := strconv.ParseFloat(clean, 64)
		if err != nil || val < 1000 {
			continue
		}

		if isRial {
			return val / 10
		}
		return val
	}

	return 0
}

func normalizePersianDigits(s string) string {
	r := strings.NewReplacer(
		"۰", "0", "۱", "1", "۲", "2", "۳", "3", "۴", "4",
		"۵", "5", "۶", "6", "۷", "7", "۸", "8", "۹", "9",
		"٠", "0", "١", "1", "٢", "2", "٣", "3", "٤", "4",
		"٥", "5", "٦", "6", "٧", "7", "٨", "8", "٩", "9",
	)
	return r.Replace(s)
}
