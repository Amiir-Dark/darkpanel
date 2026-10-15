package handlers

import (
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"darkpanel-bot/keyboards"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

func (h *BotHandler) handleAdminCommand(msg *tgbotapi.Message) {
	tgID := msg.From.ID
	if !h.cfg.IsAdmin(tgID) {
		_, _ = h.bot.Send(tgbotapi.NewMessage(tgID, "⛔️ شما دسترسی به پنل مدیریت ندارید."))
		return
	}

	h.sendAdminPanel(tgID)
}

func (h *BotHandler) sendAdminPanel(tgID int64) {
	price := h.getPricePerGB()
	card := h.db.GetSetting("card_number", "تنظیم نشده")
	trial := h.db.GetSetting("trial_enabled", "true")

	text := fmt.Sprintf(
		"👑 *پنل مدیریت ربات فروش DarkPanel*\n\n"+
			"💰 *قیمت هر گیگابایت:* `%.0f` تومان\n"+
			"💳 *شماره کارت فعال:* `%s`\n"+
			"🎁 *وضعیت تست رایگان:* %s\n\n"+
			"جهت تغییر هر یک از موارد، دکمه مورد نظر را لمس نمایید:",
		price, card, trial,
	)

	m := tgbotapi.NewMessage(tgID, text)
	m.ParseMode = tgbotapi.ModeMarkdown
	m.ReplyMarkup = keyboards.AdminMenuInline()
	_, _ = h.bot.Send(m)
}

func (h *BotHandler) handleAdminCallback(query *tgbotapi.CallbackQuery) {
	tgID := query.From.ID
	if !h.cfg.IsAdmin(tgID) {
		return
	}

	data := query.Data

	switch data {
	case "adm_set_price":
		h.db.SetUserState(tgID, "adm_waiting_price", "")
		m := tgbotapi.NewMessage(tgID, "💰 لطفاً قیمت جدید هر گیگابایت را به *تومان* وارد نمایید (مثال: `5000`):")
		m.ParseMode = tgbotapi.ModeMarkdown
		m.ReplyMarkup = keyboards.CancelKeyboard()
		_, _ = h.bot.Send(m)

	case "adm_set_card":
		h.db.SetUserState(tgID, "adm_waiting_card", "")
		m := tgbotapi.NewMessage(tgID, "💳 لطفاً اطلاعات کارت را در یک پیام با فرمت زیر ارسال کنید:\n\n`شماره کارت | نام صاحب حساب | شماره شبا`\n\nمثال:\n`6037991812345678 | امیر حسینی | IR120000000000000000000000`")
		m.ParseMode = tgbotapi.ModeMarkdown
		m.ReplyMarkup = keyboards.CancelKeyboard()
		_, _ = h.bot.Send(m)

	case "adm_set_crypto":
		h.db.SetUserState(tgID, "adm_waiting_crypto", "")
		m := tgbotapi.NewMessage(tgID, "💎 لطفاً آدرس کیف پول Tether TRC20 جدید را ارسال کنید:")
		m.ParseMode = tgbotapi.ModeMarkdown
		m.ReplyMarkup = keyboards.CancelKeyboard()
		_, _ = h.bot.Send(m)

	case "adm_set_trial":
		current := h.db.GetSetting("trial_enabled", "true")
		newVal := "false"
		if current == "false" {
			newVal = "true"
		}
		_ = h.db.SetSetting("trial_enabled", newVal)
		cb := tgbotapi.NewCallback(query.ID, fmt.Sprintf("تست رایگان تغییر یافت به: %s", newVal))
		_, _ = h.bot.Request(cb)
		h.sendAdminPanel(tgID)

	case "adm_broadcast":
		h.db.SetUserState(tgID, "adm_waiting_broadcast", "")
		m := tgbotapi.NewMessage(tgID, "📢 لطفاً پیامی که مایلید برای تمام کاربران ربات ارسال شود را بفرستید:")
		m.ReplyMarkup = keyboards.CancelKeyboard()
		_, _ = h.bot.Send(m)

	case "adm_stats":
		stats, err := h.db.GetStats()
		if err != nil {
			log.Printf("Error getting stats: %v", err)
			return
		}
		text := fmt.Sprintf(
			"📈 *آمار و عملکرد ربات:*\n\n"+
				"👥 *تعداد کل اعضا:* `%d` نفر\n"+
				"🟢 *تعداد سرویس‌های فعال:* `%d` سرویس\n"+
				"💰 *مجموع دریافتی‌های تایید شده:* `%.0f` تومان\n"+
				"🌐 *مجموع ترافیک مصرف شده کاربران:* `%.2f` گیگابایت",
			stats.TotalUsers, stats.ActiveServices, stats.TotalDeposited, stats.TotalTrafficGB,
		)
		m := tgbotapi.NewMessage(tgID, text)
		m.ParseMode = tgbotapi.ModeMarkdown
		_, _ = h.bot.Send(m)

	case "adm_users":
		users, err := h.db.GetAllUsers()
		if err != nil {
			return
		}
		var sb strings.Builder
		sb.WriteString("👥 *لیست آخرین کاربران ربات:*\n\n")

		limit := 20
		if len(users) < limit {
			limit = len(users)
		}

		for i := 0; i < limit; i++ {
			u := users[i]
			statusIcon := "⚪️"
			if u.ServiceStatus == "active" {
				statusIcon = "🟢"
			} else if u.ServiceStatus == "suspended" {
				statusIcon = "🔴"
			}
			sb.WriteString(fmt.Sprintf("%s `%d` | @%s | شارژ: `%.0f` ت\n", statusIcon, u.TelegramID, u.Username, u.WalletBalance))
		}

		m := tgbotapi.NewMessage(tgID, sb.String())
		m.ParseMode = tgbotapi.ModeMarkdown
		_, _ = h.bot.Send(m)
	}
}

func (h *BotHandler) handleAdminSetPriceInput(msg *tgbotapi.Message) {
	tgID := msg.From.ID
	valStr := strings.TrimSpace(msg.Text)
	val, err := strconv.ParseFloat(valStr, 64)
	if err != nil || val <= 0 {
		_, _ = h.bot.Send(tgbotapi.NewMessage(tgID, "⚠️ لطفاً یک رقم عددی معتبر وارد کنید."))
		return
	}

	_ = h.db.SetSetting("price_per_gb", fmt.Sprintf("%.0f", val))
	h.db.ClearUserState(tgID)

	_, _ = h.bot.Send(tgbotapi.NewMessage(tgID, fmt.Sprintf("✅ قیمت هر گیگابایت با موفقیت به %.0f تومان تغییر یافت.", val)))
	h.sendAdminPanel(tgID)
}

func (h *BotHandler) handleAdminSetCardInput(msg *tgbotapi.Message) {
	tgID := msg.From.ID
	text := strings.TrimSpace(msg.Text)
	parts := strings.Split(text, "|")

	if len(parts) >= 1 {
		_ = h.db.SetSetting("card_number", strings.TrimSpace(parts[0]))
	}
	if len(parts) >= 2 {
		_ = h.db.SetSetting("card_holder", strings.TrimSpace(parts[1]))
	}
	if len(parts) >= 3 {
		_ = h.db.SetSetting("card_shaba", strings.TrimSpace(parts[2]))
	}

	h.db.ClearUserState(tgID)
	_, _ = h.bot.Send(tgbotapi.NewMessage(tgID, "✅ اطلاعات کارت بانکی با موفقیت به‌روزرسانی شد."))
	h.sendAdminPanel(tgID)
}

func (h *BotHandler) handleAdminSetCryptoInput(msg *tgbotapi.Message) {
	tgID := msg.From.ID
	address := strings.TrimSpace(msg.Text)

	if len(address) < 10 {
		_, _ = h.bot.Send(tgbotapi.NewMessage(tgID, "⚠️ آدرس کیف پول نامعتبر است."))
		return
	}

	_ = h.db.SetSetting("crypto_wallet_trc20", address)
	h.db.ClearUserState(tgID)

	_, _ = h.bot.Send(tgbotapi.NewMessage(tgID, "✅ آدرس کیف پول تتر با موفقیت ثبت شد."))
	h.sendAdminPanel(tgID)
}

func (h *BotHandler) handleAdminBroadcastInput(msg *tgbotapi.Message) {
	tgID := msg.From.ID
	broadcastText := msg.Text

	h.db.ClearUserState(tgID)
	users, err := h.db.GetAllUsers()
	if err != nil {
		_, _ = h.bot.Send(tgbotapi.NewMessage(tgID, "خطا در دریافت لیست کاربران."))
		return
	}

	_, _ = h.bot.Send(tgbotapi.NewMessage(tgID, fmt.Sprintf("⏳ در حال ارسال پیام همگانی به %d کاربر...", len(users))))

	sent := 0
	for _, u := range users {
		m := tgbotapi.NewMessage(u.TelegramID, broadcastText)
		m.ParseMode = tgbotapi.ModeMarkdown
		if _, err := h.bot.Send(m); err == nil {
			sent++
		}
		time.Sleep(30 * time.Millisecond) // Rate limit prevention
	}

	_, _ = h.bot.Send(tgbotapi.NewMessage(tgID, fmt.Sprintf("✅ پیام همگانی با موفقیت برای %d کاربر ارسال شد.", sent)))
	h.sendAdminPanel(tgID)
}
