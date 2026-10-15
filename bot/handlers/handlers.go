package handlers

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"darkpanel-bot/client"
	"darkpanel-bot/config"
	"darkpanel-bot/database"
	"darkpanel-bot/keyboards"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

type BotHandler struct {
	bot    *tgbotapi.BotAPI
	db     *database.DB
	client *client.PanelClient
	cfg    *config.Config
}

func NewBotHandler(bot *tgbotapi.BotAPI, db *database.DB, c *client.PanelClient, cfg *config.Config) *BotHandler {
	return &BotHandler{
		bot:    bot,
		db:     db,
		client: c,
		cfg:    cfg,
	}
}

func (h *BotHandler) HandleUpdate(update tgbotapi.Update) {
	if update.CallbackQuery != nil {
		h.handleCallback(update.CallbackQuery)
		return
	}

	if update.Message == nil {
		return
	}

	msg := update.Message
	tgID := msg.From.ID

	// Register / update user in DB
	user, err := h.db.CreateOrUpdateUser(tgID, msg.From.UserName, msg.From.FirstName)
	if err != nil {
		log.Printf("Error updating user %d: %v", tgID, err)
	}

	// Check conversation state (FSM)
	state, stateData := h.db.GetUserState(tgID)

	if msg.Text == "❌ انصراف و بازگشت" {
		h.db.ClearUserState(tgID)
		h.sendMainMenu(tgID, user, "عملیات لغو شد. به منوی اصلی بازگشتید.")
		return
	}

	if state != "" {
		h.handleStateInput(msg, user, state, stateData)
		return
	}

	if msg.IsCommand() {
		switch msg.Command() {
		case "start":
			h.handleStart(msg, user)
		case "admin":
			h.handleAdminCommand(msg)
		default:
			h.sendMainMenu(tgID, user, "دستور نامعتبر است.")
		}
		return
	}

	// Reply keyboard text matching
	switch msg.Text {
	case "🚀 دریافت و فعال‌سازی سرویس":
		h.handleActivateService(msg, user)
	case "💳 کیف پول و شارژ حساب":
		h.handleWallet(msg, user)
	case "📊 استعلام مصرف و وضعیت":
		h.handleUsageStats(msg, user)
	case "🔗 لینک اتصال هوشمند":
		h.handleMySubscription(msg, user)
	case "🎁 تست رایگان":
		h.handleTrial(msg, user)
	case "📖 راهنمای اتصال و دانلود":
		h.handleGuide(msg)
	case "☎️ پشتیبانی":
		h.handleSupport(msg)
	case "👑 پنل مدیریت ربات":
		h.handleAdminCommand(msg)
	default:
		h.sendMainMenu(tgID, user, "لطفاً یکی از گزینه‌های زیر را انتخاب نمایید:")
	}
}

func (h *BotHandler) sendMainMenu(tgID int64, user *database.User, text string) {
	hasService := user != nil && user.SubURL != ""
	isAdmin := h.cfg.IsAdmin(tgID)

	msg := tgbotapi.NewMessage(tgID, text)
	msg.ReplyMarkup = keyboards.MainMenuKeyboard(hasService, isAdmin)
	msg.ParseMode = tgbotapi.ModeMarkdown
	_, _ = h.bot.Send(msg)
}

func (h *BotHandler) handleStart(msg *tgbotapi.Message, user *database.User) {
	pricePerGB := h.getPricePerGB()

	welcome := fmt.Sprintf(
		"👋 سلام %s عزیز، به ربات هوشمند اشتراک و اینترنت آزاد خوش آمدید!\n\n"+
			"🌟 *سیستم پرداخت به میزان مصرف (Pay As You Go):*\n"+
			"• در این سیستم، نیاز به خرید کانفیگ‌های محدود یا گران‌قیمت ندارید!\n"+
			"• با یکبار فعال‌سازی، لینک اتصال هوشمند به شما داده می‌شود.\n"+
			"• هزینه فقط به ازای ترافیک مصرفی واقعی شما از کیف پول کسر می‌گردد.\n\n"+
			"💰 *تعرفه فعلی:* `%.0f` تومان به ازای هر ۱ گیگابایت ترافیک\n"+
			"💳 *موجودی فعلی شما:* `%.0f` تومان\n\n"+
			"جهت شروع، از منوی زیر استفاده نمایید:",
		msg.From.FirstName,
		pricePerGB,
		user.WalletBalance,
	)

	h.sendMainMenu(msg.From.ID, user, welcome)
}

func (h *BotHandler) handleActivateService(msg *tgbotapi.Message, user *database.User) {
	tgID := msg.From.ID

	if user.SubURL != "" && user.ServiceStatus == "active" {
		reply := fmt.Sprintf(
			"✅ *شما قبلاً سرویس خود را فعال کرده‌اید.*\n\n"+
				"🔗 *لینک سابسکریپشن اختصاصی شما:*\n`%s`\n\n"+
				"📌 این لینک را در نرم‌افزارهای V2rayNG, Streisand, Shadowrocket یا Sing-box کپی و ایمپورت کنید.",
			user.SubURL,
		)
		h.sendMainMenu(tgID, user, reply)
		return
	}

	minBalance := h.cfg.MinBalanceToStart
	if user.WalletBalance < minBalance {
		text := fmt.Sprintf(
			"⚠️ *موجودی کیف پول شما کافی نیست.*\n\n"+
				"💰 حداقل موجودی برای شروع سرویس: `%.0f` تومان\n"+
				"💳 موجودی فعلی شما: `%.0f` تومان\n\n"+
				"لطفاً ابتدا کیف پول خود را شارژ کنید:",
			minBalance, user.WalletBalance,
		)
		m := tgbotapi.NewMessage(tgID, text)
		m.ParseMode = tgbotapi.ModeMarkdown
		m.ReplyMarkup = keyboards.PaymentOptionsInline()
		_, _ = h.bot.Send(m)
		return
	}

	// Create user on DarkPanel
	panelUsername := fmt.Sprintf("tg_%d", tgID)
	note := fmt.Sprintf("Telegram User: %s (@%s)", msg.From.FirstName, msg.From.UserName)

	waitMsg, _ := h.bot.Send(tgbotapi.NewMessage(tgID, "⏳ در حال ساخت اکانت اختصاصی و صدور لینک هوشمند..."))

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	created, err := h.client.CreateUser(ctx, panelUsername, note)
	if err != nil {
		log.Printf("Error creating panel user %s: %v", panelUsername, err)
		// Check if user already existed on panel
		existing, getErr := h.client.GetUser(ctx, panelUsername)
		if getErr == nil && existing != nil {
			created = &client.CreateUserResponse{
				Username:        existing.Username,
				Status:          existing.Status,
				SubscriptionURL: existing.SubscriptionURL,
			}
		} else {
			_, _ = h.bot.Send(tgbotapi.NewMessage(tgID, "❌ متاسفانه در ارتباط با سرور خطایی رخ داد. لطفاً به پشتیبانی پیام دهید."))
			return
		}
	}

	_ = h.db.SetServiceStatus(tgID, "active", panelUsername, created.SubscriptionURL)
	user.ServiceStatus = "active"
	user.PanelUsername = panelUsername
	user.SubURL = created.SubscriptionURL

	// Initialize usage tracking record
	_ = h.db.SaveUsageTracking(&database.UsageRecord{
		UserID:           tgID,
		PanelUsername:    panelUsername,
		LastSyncedBytes:  0,
		TotalBilledBytes: 0,
	})

	if waitMsg.MessageID > 0 {
		deleteMsg := tgbotapi.NewDeleteMessage(tgID, waitMsg.MessageID)
		_, _ = h.bot.Send(deleteMsg)
	}

	successText := fmt.Sprintf(
		"🎉 *سرویس هوشمند شما با موفقیت فعال شد!*\n\n"+
			"🔗 *لینک سابسکریپشن شما (لمس کنید تا کپی شود):*\n`%s`\n\n"+
			"📱 *نحوه استفاده:*\n"+
			"۱. لینک بالا را کپی کنید.\n"+
			"۲. نرم‌افزار مورد نظرتان (V2rayNG در اندروید، Streisand/Shadowrocket در آیفون، Nekoray/V2rayN در ویندوز) را باز کنید.\n"+
			"۳. گزینه Import from Clipboard را بزنید.\n"+
			"۴. کانکشن‌ها بارگذاری می‌شوند و می‌توانید متصل شوید.\n\n"+
			"⚡️ *نکته مهم:* هزینه تنها در ازای مصرف واقعی شما و هر چند دقیقه یکبار از کیف پول کسر می‌شود.",
		created.SubscriptionURL,
	)

	h.sendMainMenu(tgID, user, successText)
}

func (h *BotHandler) handleWallet(msg *tgbotapi.Message, user *database.User) {
	pricePerGB := h.getPricePerGB()

	var estGB float64
	if pricePerGB > 0 {
		estGB = user.WalletBalance / pricePerGB
	}

	text := fmt.Sprintf(
		"💳 *کیف پول و مدیریت حساب*\n\n"+
			"💰 *موجودی فعلی:* `%.0f` تومان\n"+
			"📊 *معادل ترافیک قابل استفاده:* حدود `%.2f` گیگابایت\n"+
			"💸 *مجموع پرداختی‌های شما:* `%.0f` تومان\n\n"+
			"👇 جهت افزایش موجودی و شارژ حساب، یکی از روش‌های زیر را انتخاب کنید:",
		user.WalletBalance, estGB, user.TotalSpent,
	)

	m := tgbotapi.NewMessage(msg.From.ID, text)
	m.ParseMode = tgbotapi.ModeMarkdown
	m.ReplyMarkup = keyboards.PaymentOptionsInline()
	_, _ = h.bot.Send(m)
}

func (h *BotHandler) handleUsageStats(msg *tgbotapi.Message, user *database.User) {
	tgID := msg.From.ID
	if user.SubURL == "" || user.PanelUsername == "" {
		h.sendMainMenu(tgID, user, "شما هنوز سرویسی فعال نکرده‌اید. ابتدا از دکمه «دریافت و فعال‌سازی سرویس» استفاده نمایید.")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pUser, err := h.client.GetUser(ctx, user.PanelUsername)
	if err != nil || pUser == nil {
		h.sendMainMenu(tgID, user, "در دریافت آمار مصرف از سرور خطایی رخ داد. لطفاً چند لحظه بعد تلاش کنید.")
		return
	}

	usedGB := float64(pUser.UsedTraffic) / (1024 * 1024 * 1024)
	pricePerGB := h.getPricePerGB()
	var estGB float64
	if pricePerGB > 0 {
		estGB = user.WalletBalance / pricePerGB
	}

	statusText := "🟢 فعال"
	if user.ServiceStatus == "suspended" || pUser.Status == "disabled" {
		statusText = "🔴 مسدود (نیازمند شارژ کیف پول)"
	}

	text := fmt.Sprintf(
		"📊 *گزارش مصرف و وضعیت سرویس*\n\n"+
			"👤 *نام کاربری پنل:* `%s`\n"+
			"📶 *وضعیت اتصال:* %s\n"+
			"📈 *کل مصرف ترافیک شما:* `%.3f` گیگابایت\n"+
			"💰 *موجودی کیف پول:* `%.0f` تومان\n"+
			"⏳ *ترافیک قابل استفاده با موجودی فعلی:* `%.2f` گیگابایت\n\n"+
			"🔗 *لینک سابسکریپشن:*\n`%s`",
		user.PanelUsername,
		statusText,
		usedGB,
		user.WalletBalance,
		estGB,
		user.SubURL,
	)

	h.sendMainMenu(tgID, user, text)
}

func (h *BotHandler) handleMySubscription(msg *tgbotapi.Message, user *database.User) {
	tgID := msg.From.ID
	if user.SubURL == "" {
		h.sendMainMenu(tgID, user, "شما هنوز سرویسی فعال نکرده‌اید. ابتدا از دکمه «دریافت و فعال‌سازی سرویس» استفاده کنید.")
		return
	}

	text := fmt.Sprintf(
		"🔗 *لینک اتصال هوشمند شما:*\n\n"+
			"`%s`\n\n"+
			"👆 *جهت کپی لینک، روی کادر بالا ضربه بزنید.*\n\n"+
			"📌 تمامی پروتکل‌های فعال سرور (Vless, Vmess, Trojan, Shadowsocks, Hysteria, MTProto, OpenVPN) در این لینک گنجانده شده‌اند.",
		user.SubURL,
	)

	h.sendMainMenu(tgID, user, text)
}

func (h *BotHandler) handleTrial(msg *tgbotapi.Message, user *database.User) {
	tgID := msg.From.ID
	trialEnabled := h.db.GetSetting("trial_enabled", "true") == "true"
	if !trialEnabled {
		h.sendMainMenu(tgID, user, "❌ در حال حاضر قابلیت تست رایگان غیرفعال است.")
		return
	}

	if user.SubURL != "" {
		h.sendMainMenu(tgID, user, "⚠️ شما قبلاً سرویس دریافت کرده‌اید و امکان فعال‌سازی مجدد تست رایگان وجود ندارد.")
		return
	}

	// Give free 1GB balance to wallet
	trialBonus := h.getPricePerGB() // 1 GB value
	_, _ = h.db.UpdateWallet(tgID, trialBonus)

	text := fmt.Sprintf(
		"🎁 *تست رایگان برای شما فعال شد!*\n\n"+
			"به میزان ۱ گیگابایت معادل `%.0f` تومان به کیف پول شما اعتبار هدیه اضافه شد.\n"+
			"اکنون می‌توانید از گزینه «🚀 دریافت و فعال‌سازی سرویس» استفاده کنید.",
		trialBonus,
	)

	user.WalletBalance += trialBonus
	h.sendMainMenu(tgID, user, text)
}

func (h *BotHandler) handleGuide(msg *tgbotapi.Message) {
	guideText := `📖 *راهنمای اتصال و دانلود نرم‌افزارها:*

📱 *اندروید (Android):*
• نرم‌افزار پیشنهادی: *v2rayNG* یا *sing-box*
• دانلود از گوگل پلی یا گیت‌هاب: [v2rayNG](https://github.com/2dust/v2rayNG/releases)
• آموزش: لینک سابسکریپشن خود را کپی کنید، وارد برنامه شوید و علامت + بالای صفحه را بزنید و گزینه Import from clipboard را انتخاب کنید.

🍏 *آیفون و آیپد (iOS):*
• نرم‌افزارهای پیشنهادی: *Streisand* یا *FoXray* یا *Shadowrocket* یا *V2Box*
• آموزش: در برنامه وارد بخش Subscription یا Config شوید، لینک را اضافه کنید و Update Subscription را بزنید.

💻 *ویندوز (Windows):*
• نرم‌افزار پیشنهادی: *Nekoray* یا *v2rayN*
• دانلود از گیت‌هاب: [v2rayN](https://github.com/2dust/v2rayN/releases)`

	m := tgbotapi.NewMessage(msg.From.ID, guideText)
	m.ParseMode = tgbotapi.ModeMarkdown
	m.DisableWebPagePreview = true
	_, _ = h.bot.Send(m)
}

func (h *BotHandler) handleSupport(msg *tgbotapi.Message) {
	supportID := h.db.GetSetting("support_id", h.cfg.SupportUsername)
	channelID := h.db.GetSetting("channel_id", h.cfg.ChannelUsername)

	text := fmt.Sprintf(
		"☎️ *پشتیبانی و ارتباط با ما:*\n\n"+
			"در صورت بروز هرگونه مشکل در اتصال یا سوال درباره شارژ حساب، می‌توانید با آی‌دی پشتیبانی در ارتباط باشید:\n\n"+
			"👤 پشتیبانی: %s\n"+
			"📢 کانال اطلاع‌رسانی: %s",
		supportID, channelID,
	)

	m := tgbotapi.NewMessage(msg.From.ID, text)
	m.ParseMode = tgbotapi.ModeMarkdown
	_, _ = h.bot.Send(m)
}

func (h *BotHandler) getPricePerGB() float64 {
	priceStr := h.db.GetSetting("price_per_gb", fmt.Sprintf("%.0f", h.cfg.DefaultPricePerGB))
	if p, err := strconv.ParseFloat(priceStr, 64); err == nil && p > 0 {
		return p
	}
	return h.cfg.DefaultPricePerGB
}
