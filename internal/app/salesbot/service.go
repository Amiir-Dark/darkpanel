package salesbot

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

type ServiceStatus struct {
	Running     bool   `json:"running"`
	Status      string `json:"status"` // running, stopped, starting, error
	Uptime      string `json:"uptime"`
	UptimeSec   int64  `json:"uptime_seconds"`
	BotUsername string `json:"bot_username"`
	WebhookPort int    `json:"webhook_port"`
	LastError   string `json:"last_error"`
}

type Service struct {
	mu            sync.RWMutex
	status        string
	uptime        time.Time
	lastError     string
	botUsername   string
	botToken      string
	cancel        context.CancelFunc
	webhookServer *http.Server
	tgClient      *TelegramClient
}

var (
	globalService     *Service
	globalServiceOnce sync.Once
)

func GetService() *Service {
	globalServiceOnce.Do(func() {
		globalService = &Service{
			status:   "stopped",
			tgClient: NewTelegramClient(),
		}
	})
	return globalService
}

func (s *Service) Status() ServiceStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	running := s.status == "running"
	var uptimeStr string
	var uptimeSec int64
	if running && !s.uptime.IsZero() {
		dur := time.Since(s.uptime)
		uptimeSec = int64(dur.Seconds())
		h := int(dur.Hours())
		m := int(dur.Minutes()) % 60
		sSec := int(dur.Seconds()) % 60
		uptimeStr = fmt.Sprintf("%02d:%02d:%02d", h, m, sSec)
	}

	port := GetSettingInt("forapp_port", 8085)

	return ServiceStatus{
		Running:     running,
		Status:      s.status,
		Uptime:      uptimeStr,
		UptimeSec:   uptimeSec,
		BotUsername: s.botUsername,
		WebhookPort: port,
		LastError:   s.lastError,
	}
}

func (s *Service) Start(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.status == "running" {
		return nil
	}

	s.status = "starting"
	s.lastError = ""

	token := strings.TrimSpace(GetSetting("bot_token", ""))
	if token == "" {
		s.status = "stopped"
		s.lastError = "توکن ربات تلگرام در تنظیمات وارد نشده است"
		return fmt.Errorf("%s", s.lastError)
	}

	// Verify token with Telegram (re-init client with latest proxy settings)
	s.tgClient = NewTelegramClient()
	testCtx, testCancel := context.WithTimeout(ctx, 12*time.Second)
	defer testCancel()

	me, err := s.tgClient.GetMe(testCtx, token)
	if err != nil {
		s.status = "error"
		s.lastError = fmt.Sprintf("خطا در برقراری ارتباط با تلگرام: %v (اگر سرور در ایران است، پروکسی تلگرام را در تنظیمات ثبت کنید)", err)
		return fmt.Errorf("%s", s.lastError)
	}

	s.botUsername = me.Username
	s.botToken = token

	subCtx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel

	// 1. Start ForApp Webhook HTTP server
	webhookPort := GetSettingInt("forapp_port", 8085)
	webhookPath := GetSetting("forapp_path", "/webhook/forapp")

	mux := http.NewServeMux()
	mux.HandleFunc(webhookPath, s.HandleForAppWebhook)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", webhookPort),
		Handler: mux,
	}
	s.webhookServer = server

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.mu.Lock()
			s.lastError = fmt.Sprintf("خطای سرور وب‌هوک (پورت %d): %v", webhookPort, err)
			s.mu.Unlock()
		}
	}()

	// 2. Start 5-Minute Order Expiration Loop
	go s.runOrderExpirationLoop(subCtx)

	// 3. Start Telegram Long Polling Loop
	go s.runTelegramPollingLoop(subCtx, token)

	s.status = "running"
	s.uptime = time.Now()
	s.lastError = ""

	return nil
}

func (s *Service) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.status == "stopped" {
		return nil
	}

	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
	}

	if s.webhookServer != nil {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = s.webhookServer.Shutdown(shutdownCtx)
		s.webhookServer = nil
	}

	s.status = "stopped"
	return nil
}

func (s *Service) Restart(ctx context.Context) error {
	_ = s.Stop()
	time.Sleep(500 * time.Millisecond)
	return s.Start(ctx)
}

func (s *Service) runTelegramPollingLoop(ctx context.Context, token string) {
	var offset int64 = 0

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		pollCtx, cancel := context.WithTimeout(ctx, 35*time.Second)
		updates, err := s.tgClient.GetUpdates(pollCtx, token, offset, 25)
		cancel()

		if err != nil {
			if ctx.Err() != nil {
				return
			}
			time.Sleep(3 * time.Second)
			continue
		}

		for _, u := range updates {
			if u.UpdateID >= offset {
				offset = u.UpdateID + 1
			}
			s.handleUpdate(ctx, u)
		}
	}
}

func (s *Service) runOrderExpirationLoop(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.checkExpiredOrders(ctx)
		}
	}
}

func (s *Service) checkExpiredOrders(ctx context.Context) {
	db, _, err := GetDB()
	if err != nil {
		return
	}

	rows, err := db.Query(`
		SELECT id, user_id, amount_exact, code 
		FROM orders 
		WHERE status = 'pending' AND expires_at <= datetime('now')`)
	if err != nil {
		return
	}
	defer rows.Close()

	type expiredInfo struct {
		id          int64
		userID      int64
		amountExact float64
		code        string
	}
	var expiredList []expiredInfo

	for rows.Next() {
		var exp expiredInfo
		if err := rows.Scan(&exp.id, &exp.userID, &exp.amountExact, &exp.code); err == nil {
			expiredList = append(expiredList, exp)
		}
	}

	for _, item := range expiredList {
		_, _ = db.Exec(`UPDATE orders SET status = 'expired' WHERE id = ? AND status = 'pending'`, item.id)

		// Notify user that 5-minute payment window has expired
		go func(exp expiredInfo) {
			notifyCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			text := fmt.Sprintf(
				"⏰ <b>مهلت پرداخت سفارش شما به پایان رسید!</b>\n\n"+
					"فاکتور پرداخت به مبلغ %s تومان منقضی گردید.\n"+
					"اگر واریز را انجام نداده‌اید، می‌توانید از منوی اصلی مجدداً درخواست شارژ دهید.",
				formatCurrency(exp.amountExact),
			)
			_ = s.tgClient.SendMessage(notifyCtx, s.botToken, exp.userID, text, mainKeyboard())
		}(item)
	}
}
