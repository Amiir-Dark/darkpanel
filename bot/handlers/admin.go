package handlers

import (
	"context"
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
	case "adm_transactions":
		h.handleAdminTransactions(query)

	case "adm_inbounds":
		h.handleAdminInbounds(query)

	case "adm_pending_receipts":
		h.handleAdminPendingReceipts(query)

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

func (h *BotHandler) handleAdminTransactions(query *tgbotapi.CallbackQuery) {
	tgID := query.From.ID
	price := h.getPricePerGB()

	finStats, err := h.db.GetFinancialStats(price)
	if err != nil {
		log.Printf("Error getting financial stats: %v", err)
		return
	}

	recent, err := h.db.GetRecentTransactions(10)
	if err != nil {
		log.Printf("Error getting recent transactions: %v", err)
		return
	}

	var sb strings.Builder
	sb.WriteString("💳 *گزارش جامع مالی و تراکنش‌ها*\n\n")
	sb.WriteString(fmt.Sprintf("💰 *کل واریزی‌های تایید شده:* `%.0f` تومان\n", finStats.TotalApproved))
	sb.WriteString(fmt.Sprintf("📅 *واریزی‌های امروز:* `%.0f` تومان\n", finStats.TodayApproved))
	sb.WriteString(fmt.Sprintf("📆 *واریزی‌های ۷ روز اخیر:* `%.0f` تومان\n", finStats.WeekApproved))
	sb.WriteString(fmt.Sprintf("⏳ *فیش‌های در انتظار بررسی:* `%d` عدد (مجموع: `%.0f` ت)\n", finStats.TotalPendingCount, finStats.TotalPendingAmount))
	sb.WriteString(fmt.Sprintf("❌ *فیش‌های رد شده:* `%d` عدد\n", finStats.TotalRejectedCount))
	sb.WriteString(fmt.Sprintf("🌐 *کل ترافیک مصرفی کسر شده:* `%.2f` گیگابایت\n", finStats.TotalBilledTrafficGB))
	sb.WriteString(fmt.Sprintf("💵 *درآمد حاصل از مصرف ترافیک:* `%.0f` تومان\n\n", finStats.TotalBilledRevenue))

	sb.WriteString("📜 *آخرین ۱۰ تراکنش ثبت‌شده:*\n")
	if len(recent) == 0 {
		sb.WriteString("هنوز تراکنشی ثبت نشده است.\n")
	} else {
		for _, r := range recent {
			statusIcon := "⏳"
			if r.Status == "approved" {
				statusIcon = "✅"
			} else if r.Status == "rejected" {
				statusIcon = "❌"
			}
			userDisplay := fmt.Sprintf("`%d`", r.UserID)
			if r.Username != "" {
				userDisplay = "@" + r.Username
			}
			timeStr := r.CreatedAt.Format("01/02 15:04")
			sb.WriteString(fmt.Sprintf("%s #%d | %s | `%.0f` ت | %s\n", statusIcon, r.ID, userDisplay, r.Amount, timeStr))
		}
	}

	m := tgbotapi.NewMessage(tgID, sb.String())
	m.ParseMode = tgbotapi.ModeMarkdown
	_, _ = h.bot.Send(m)
}

func (h *BotHandler) handleAdminPendingReceipts(query *tgbotapi.CallbackQuery) {
	tgID := query.From.ID
	pending, err := h.db.GetPendingReceipts()
	if err != nil {
		log.Printf("Error getting pending receipts: %v", err)
		return
	}

	if len(pending) == 0 {
		m := tgbotapi.NewMessage(tgID, "✅ هیچ فیشی در صف انتظار بررسی وجود ندارد.")
		_, _ = h.bot.Send(m)
		return
	}

	m := tgbotapi.NewMessage(tgID, fmt.Sprintf("📩 *تعداد %d فیش در انتظار بررسی یافت شد:*\nدر حال ارسال فیش‌ها...", len(pending)))
	m.ParseMode = tgbotapi.ModeMarkdown
	_, _ = h.bot.Send(m)

	for _, r := range pending {
		userDisplay := fmt.Sprintf("کاربر: `%d`", r.UserID)
		if r.Username != "" {
			userDisplay = fmt.Sprintf("%s (@%s)", r.FirstName, r.Username)
		}
		caption := fmt.Sprintf(
			"🔔 *فیش شماره #%d*\n\n"+
				"👤 %s\n"+
				"💰 مبلغ: `%.0f` تومان\n"+
				"📅 زمان: %s",
			r.ID, userDisplay, r.Amount, r.CreatedAt.Format("2006-01-02 15:04:05"),
		)
		photoMsg := tgbotapi.NewPhoto(tgID, tgbotapi.FileID(r.FileID))
		photoMsg.Caption = caption
		photoMsg.ParseMode = tgbotapi.ModeMarkdown
		photoMsg.ReplyMarkup = keyboards.AdminReceiptApprovalInline(r.ID, r.Amount)
		_, _ = h.bot.Send(photoMsg)
		time.Sleep(50 * time.Millisecond)
	}
}

func (h *BotHandler) handleAdminInbounds(query *tgbotapi.CallbackQuery) {
	tgID := query.From.ID

	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()

	waitMsg, _ := h.bot.Send(tgbotapi.NewMessage(tgID, "⏳ در حال دریافت آمار لحظه‌ای اینباندها و سرور از DarkPanel..."))

	inboundsData, err := h.client.GetInbounds(ctx)
	if err != nil {
		log.Printf("Error fetching inbounds: %v", err)
	}

	systemData, _ := h.client.GetSystemStats(ctx)

	if waitMsg.MessageID > 0 {
		_, _ = h.bot.Send(tgbotapi.NewDeleteMessage(tgID, waitMsg.MessageID))
	}

	var sb strings.Builder
	sb.WriteString("📶 *آمار زنده اینباندها و وضعیت DarkPanel*\n\n")

	// Server Resource stats if available
	if systemData != nil {
		if cpu, ok := systemData["cpu_usage_percent"].(float64); ok {
			sb.WriteString(fmt.Sprintf("💻 *مصرف پردازنده (CPU):* `%.1f%%`\n", cpu))
		}
		if memUsed, ok := systemData["memory_used"].(float64); ok {
			if memTotal, ok := systemData["memory_total"].(float64); ok {
				sb.WriteString(fmt.Sprintf("🧠 *حافظه رم (RAM):* `%.1f MB / %.1f MB`\n", memUsed/(1024*1024), memTotal/(1024*1024)))
			}
		}
		if onlines, ok := systemData["online_users"].(float64); ok {
			sb.WriteString(fmt.Sprintf("👥 *کاربران آنلاین فعلی:* `%.0f` نفر\n", onlines))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("📡 *لیست اینباندهای فعال به تفکیک پروتکل:*\n")
	if inboundsData == nil || len(inboundsData) == 0 {
		sb.WriteString("اطلاعات اینباندها در دسترس نیست یا ارتباط با پنل برقرار نشد.\n")
	} else {
		count := 0
		for proto, listAny := range inboundsData {
			list, ok := listAny.([]any)
			if !ok || len(list) == 0 {
				continue
			}
			protoUpper := strings.ToUpper(proto)
			sb.WriteString(fmt.Sprintf("\n🔸 *%s* (%d اینباند):\n", protoUpper, len(list)))

			for _, itemAny := range list {
				count++
				item, ok := itemAny.(map[string]any)
				if !ok {
					continue
				}
				tag, _ := item["tag"].(string)
				port, _ := item["port"].(float64)
				network, _ := item["network"].(string)
				tls, _ := item["tls"].(string)

				var upMB, downMB float64
				if up, ok := item["uplink"].(float64); ok {
					upMB = up / (1024 * 1024)
				}
				if down, ok := item["downlink"].(float64); ok {
					downMB = down / (1024 * 1024)
				}

				sb.WriteString(fmt.Sprintf(" • `%s` | پورت: `%.0f` | شبکه: `%s/%s` | ↑ `%.1f MB` ↓ `%.1f MB`\n",
					tag, port, network, tls, upMB, downMB))
			}
		}
		if count == 0 {
			sb.WriteString("هیچ اینباندی روی پنل تعریف نشده است.\n")
		}
	}

	m := tgbotapi.NewMessage(tgID, sb.String())
	m.ParseMode = tgbotapi.ModeMarkdown
	_, _ = h.bot.Send(m)
}

