package billing

import (
	"context"
	"fmt"
	"log"
	"time"

	"darkpanel-bot/database"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

type OrderExpiryWorker struct {
	db  *database.DB
	bot *tgbotapi.BotAPI
}

func NewOrderExpiryWorker(db *database.DB, bot *tgbotapi.BotAPI) *OrderExpiryWorker {
	return &OrderExpiryWorker{
		db:  db,
		bot: bot,
	}
}

func (w *OrderExpiryWorker) Start(ctx context.Context) {
	log.Println("[ExpiryWorker] 5-minute order expiration worker started (sweep interval: 15s)")
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("[ExpiryWorker] Stopping order expiration worker...")
			return
		case <-ticker.C:
			w.sweepExpiredOrders()
		}
	}
}

func (w *OrderExpiryWorker) sweepExpiredOrders() {
	expiredList, err := w.db.GetExpiredPendingOrders()
	if err != nil {
		log.Printf("[ExpiryWorker] Error fetching expired orders: %v", err)
		return
	}

	for _, order := range expiredList {
		if err := w.db.MarkOrderExpired(order.ID); err != nil {
			log.Printf("[ExpiryWorker] Failed to mark order #%d expired: %v", order.ID, err)
			continue
		}

		// Also clear state if user is waiting
		state, _ := w.db.GetUserState(order.UserID)
		if state == "waiting_auto_pay" {
			w.db.ClearUserState(order.UserID)
		}

		// Notify user
		text := fmt.Sprintf(
			"⏰ *زمان پرداخت شما به پایان رسید!*\n\n"+
				"سفارش پرداخت به مبلغ *%s* تومان به دلیل پایان مهلت ۵ دقیقه‌ای منقضی گردید.\n\n"+
				"🔹 اگر هنوز مبلغ را واریز نکرده‌اید، لطفاً مجدداً از بخش *کیف پول و شارژ حساب* درخواست جدید با مبلغ جدید ثبت نمایید.\n"+
				"🔹 چنانچه واریز را انجام داده‌اید و پیامک بانک با تاخیر ارسال شده است، جای نگرانی نیست؛ تصویر رسید را به همراه شماره پیگیری برای پشتیبانی ربات ارسال نمایید.",
			database.FormatMoney(order.AmountExact),
		)

		msg := tgbotapi.NewMessage(order.UserID, text)
		msg.ParseMode = tgbotapi.ModeMarkdown
		if _, sendErr := w.bot.Send(msg); sendErr != nil {
			log.Printf("[ExpiryWorker] Failed to notify user %d of expired order #%d: %v", order.UserID, order.ID, sendErr)
		} else {
			log.Printf("[ExpiryWorker] Order #%d (%.0f Tomans) for user %d expired and notified successfully", order.ID, order.AmountExact, order.UserID)
		}
	}
}
