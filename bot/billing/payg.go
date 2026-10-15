package billing

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"darkpanel-bot/client"
	"darkpanel-bot/config"
	"darkpanel-bot/database"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

type PAYGEngine struct {
	db     *database.DB
	client *client.PanelClient
	cfg    *config.Config
	bot    *tgbotapi.BotAPI
}

func NewPAYGEngine(db *database.DB, c *client.PanelClient, cfg *config.Config, bot *tgbotapi.BotAPI) *PAYGEngine {
	return &PAYGEngine{
		db:     db,
		client: c,
		cfg:    cfg,
		bot:    bot,
	}
}

func (e *PAYGEngine) Start(ctx context.Context) {
	interval := time.Duration(e.cfg.SyncIntervalSeconds) * time.Second
	if interval < 30*time.Second {
		interval = 30 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	log.Printf("[PAYG] Engine started with interval: %v", interval)

	for {
		select {
		case <-ctx.Done():
			log.Println("[PAYG] Engine stopped")
			return
		case <-ticker.C:
			e.syncActiveUsers(ctx)
			e.checkSuspendedUsers(ctx)
		}
	}
}

func (e *PAYGEngine) getPricePerGB() float64 {
	priceStr := e.db.GetSetting("price_per_gb", fmt.Sprintf("%.0f", e.cfg.DefaultPricePerGB))
	if p, err := strconv.ParseFloat(priceStr, 64); err == nil && p > 0 {
		return p
	}
	return e.cfg.DefaultPricePerGB
}

func (e *PAYGEngine) syncActiveUsers(ctx context.Context) {
	users, err := e.db.GetActiveUsers()
	if err != nil {
		log.Printf("[PAYG] Error fetching active users: %v", err)
		return
	}

	pricePerGB := e.getPricePerGB()

	for _, u := range users {
		if u.PanelUsername == "" {
			continue
		}

		pUser, err := e.client.GetUser(ctx, u.PanelUsername)
		if err != nil {
			log.Printf("[PAYG] Error getting user %q from panel: %v", u.PanelUsername, err)
			continue
		}
		if pUser == nil {
			log.Printf("[PAYG] User %q not found on panel", u.PanelUsername)
			continue
		}

		tracking, err := e.db.GetUsageTracking(u.TelegramID)
		if err != nil {
			log.Printf("[PAYG] Error getting usage tracking for user %d: %v", u.TelegramID, err)
			continue
		}

		if tracking == nil {
			tracking = &database.UsageRecord{
				UserID:           u.TelegramID,
				PanelUsername:    u.PanelUsername,
				LastSyncedBytes:  pUser.UsedTraffic,
				TotalBilledBytes: 0,
			}
			_ = e.db.SaveUsageTracking(tracking)
			continue
		}

		deltaBytes := pUser.UsedTraffic - tracking.LastSyncedBytes
		// Handle counter reset on panel if used traffic drops
		if deltaBytes < 0 {
			tracking.LastSyncedBytes = pUser.UsedTraffic
			_ = e.db.SaveUsageTracking(tracking)
			continue
		}

		if deltaBytes > 0 {
			deltaGB := float64(deltaBytes) / (1024 * 1024 * 1024)
			cost := deltaGB * pricePerGB

			newBalance, err := e.db.UpdateWallet(u.TelegramID, -cost)
			if err != nil {
				log.Printf("[PAYG] Error updating wallet for user %d: %v", u.TelegramID, err)
				continue
			}

			tracking.LastSyncedBytes = pUser.UsedTraffic
			tracking.TotalBilledBytes += deltaBytes
			_ = e.db.SaveUsageTracking(tracking)

			log.Printf("[PAYG] Billed user %d (%s): %.4f GB = %.0f Toman (New Balance: %.0f T)",
				u.TelegramID, u.PanelUsername, deltaGB, cost, newBalance)

			// Check if wallet exhausted
			if newBalance <= 0 {
				log.Printf("[PAYG] Suspending user %d (%s) due to empty wallet", u.TelegramID, u.PanelUsername)
				if err := e.client.SetUserStatus(ctx, u.PanelUsername, "disabled"); err != nil {
					log.Printf("[PAYG] Error disabling user on panel: %v", err)
				}
				_ = e.db.UpdateServiceStateOnly(u.TelegramID, "suspended")

				// Send notification to user
				msgText := fmt.Sprintf(
					"⚠️ *مشترک گرامی، موجودی کیف پول شما به اتمام رسید.*\n\n"+
						"🔴 سرویس اتصال شما موقتاً غیرفعال شد.\n"+
						"💰 موجودی فعلی: `%.0f` تومان\n\n"+
						"💳 جهت اتصال مجدد، لطفاً از دکمه «کیف پول و شارژ» اقدام به افزایش موجودی نمایید.",
					newBalance,
				)
				msg := tgbotapi.NewMessage(u.TelegramID, msgText)
				msg.ParseMode = tgbotapi.ModeMarkdown
				_, _ = e.bot.Send(msg)
			}
		}
	}
}

func (e *PAYGEngine) checkSuspendedUsers(ctx context.Context) {
	// Check users with suspended status who topped up their wallet
	users, err := e.db.GetAllUsers()
	if err != nil {
		return
	}

	for _, u := range users {
		if u.ServiceStatus == "suspended" && u.WalletBalance > 0 && u.PanelUsername != "" {
			log.Printf("[PAYG] Reactivating user %d (%s) with balance %.0f", u.TelegramID, u.PanelUsername, u.WalletBalance)
			if err := e.client.SetUserStatus(ctx, u.PanelUsername, "active"); err != nil {
				log.Printf("[PAYG] Error activating user on panel: %v", err)
				continue
			}
			_ = e.db.UpdateServiceStateOnly(u.TelegramID, "active")

			msgText := fmt.Sprintf(
				"✅ *سرویس شما با موفقیت مجدداً فعال شد!*\n\n"+
					"💰 موجودی کیف پول شما: `%.0f` تومان\n"+
					"🚀 اتصال شما برقرار است و هزینه به میزان مصرف شما کسر خواهد شد.",
				u.WalletBalance,
			)
			msg := tgbotapi.NewMessage(u.TelegramID, msgText)
			msg.ParseMode = tgbotapi.ModeMarkdown
			_, _ = e.bot.Send(msg)
		}
	}
}
