package salesbot

import (
	"context"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var persianDigitsRegex = regexp.MustCompile(`[۰-۹]`)

func normalizeDigits(input string) string {
	persianMap := map[rune]rune{
		'۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
		'۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
		'٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
		'٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
	}
	var sb strings.Builder
	for _, r := range input {
		if mapped, ok := persianMap[r]; ok {
			sb.WriteRune(mapped)
		} else {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

func parseAmount(input string) (float64, error) {
	clean := normalizeDigits(input)
	clean = strings.ReplaceAll(clean, ",", "")
	clean = strings.ReplaceAll(clean, "،", "")
	clean = strings.ReplaceAll(clean, " ", "")
	clean = strings.TrimSpace(clean)

	val, err := strconv.ParseFloat(clean, 64)
	if err != nil || val <= 0 {
		return 0, fmt.Errorf("invalid amount")
	}
	return val, nil
}

func formatCurrency(val float64) string {
	rounded := int64(math.Round(val))
	s := strconv.FormatInt(rounded, 10)
	n := len(s)
	if n <= 3 {
		return s
	}
	var parts []string
	remainder := n % 3
	if remainder > 0 {
		parts = append(parts, s[:remainder])
	}
	for i := remainder; i < n; i += 3 {
		parts = append(parts, s[i:i+3])
	}
	return strings.Join(parts, ",")
}

// -------------------------------------------------------------
// Keyboards (Inline Style matching the exact screenshots)
// -------------------------------------------------------------

func mainInlineKeyboard() InlineKeyboardMarkup {
	return InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: "⭐ دریافت پنل جدید", CallbackData: "buy_panel"},
			},
			{
				{Text: "🌐 پنل‌های من", CallbackData: "my_panels"},
				{Text: "💳 موجودی", CallbackData: "wallet"},
			},
			{
				{Text: "🧪 دریافت پنل تست", CallbackData: "test_panel"},
			},
			{
				{Text: "📮 پشتیبانی", CallbackData: "support"},
			},
		},
	}
}

func mainKeyboard() InlineKeyboardMarkup {
	return mainInlineKeyboard()
}

func buyPanelKeyboard() InlineKeyboardMarkup {
	return InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: "توضیحات رو مطالعه و تایید میکنم.", CallbackData: "confirm_buy_panel"},
			},
			{
				{Text: "🔙 بازگشت به منو", CallbackData: "main_menu"},
			},
		},
	}
}

func walletKeyboard() InlineKeyboardMarkup {
	return InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: "➕ افزایش موجودی", CallbackData: "deposit"},
			},
			{
				{Text: "🎉 کد هدیه", CallbackData: "gift_code"},
			},
			{
				{Text: "🔙 بازگشت به منو", CallbackData: "main_menu"},
			},
		},
	}
}

func myPanelsKeyboard(hasPanel bool, panelURL string) InlineKeyboardMarkup {
	if !hasPanel {
		return InlineKeyboardMarkup{
			InlineKeyboard: [][]InlineKeyboardButton{
				{
					{Text: "⭐ دریافت پنل جدید", CallbackData: "buy_panel"},
				},
				{
					{Text: "🔙 بازگشت به منو", CallbackData: "main_menu"},
				},
			},
		}
	}
	var rows [][]InlineKeyboardButton
	if panelURL != "" && (strings.HasPrefix(panelURL, "http://") || strings.HasPrefix(panelURL, "https://")) {
		rows = append(rows, []InlineKeyboardButton{
			{Text: "🌐 ورود به پنل مدیریت", URL: panelURL},
		})
	}
	rows = append(rows, []InlineKeyboardButton{
		{Text: "➕ افزایش موجودی", CallbackData: "deposit"},
	})
	rows = append(rows, []InlineKeyboardButton{
		{Text: "🔙 بازگشت به منو", CallbackData: "main_menu"},
	})
	return InlineKeyboardMarkup{InlineKeyboard: rows}
}

func testPanelSuccessKeyboard(panelURL string) InlineKeyboardMarkup {
	var rows [][]InlineKeyboardButton
	if panelURL != "" && (strings.HasPrefix(panelURL, "http://") || strings.HasPrefix(panelURL, "https://")) {
		rows = append(rows, []InlineKeyboardButton{
			{Text: "🌐 ورود به پنل مدیریت", URL: panelURL},
		})
	}
	rows = append(rows, []InlineKeyboardButton{
		{Text: "🔙 بازگشت به منو", CallbackData: "main_menu"},
	})
	return InlineKeyboardMarkup{InlineKeyboard: rows}
}

func depositOnlyKeyboard() InlineKeyboardMarkup {
	return InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: "➕ افزایش موجودی", CallbackData: "deposit"},
			},
			{
				{Text: "🔙 بازگشت به منو", CallbackData: "main_menu"},
			},
		},
	}
}

func depositKeyboard() InlineKeyboardMarkup {
	return InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: "⚡ کارت به کارت هوشمند (شناسایی ۵ دقیقه‌ای)", CallbackData: "deposit_5min"},
			},
			{
				{Text: "💳 واریز کارت به کارت (ارسال فیش)", CallbackData: "deposit_receipt"},
			},
			{
				{Text: "🔙 بازگشت به منو", CallbackData: "main_menu"},
			},
		},
	}
}

func backKeyboard() InlineKeyboardMarkup {
	return InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: "🔙 بازگشت به منو", CallbackData: "main_menu"},
			},
		},
	}
}

// -------------------------------------------------------------
// Text Templates
// -------------------------------------------------------------

func getWelcomeText(u *User) string {
	customWelcome := GetSetting("welcome_message", "")
	if strings.TrimSpace(customWelcome) != "" {
		return customWelcome
	}
	brandName := GetSetting("brand_name", "گارد")
	return fmt.Sprintf("درود و خوش آمدید! 🪪\n\nبرای خرید نمایندگی بدون دردسر و اذیت، با تنوع لوکیشن بالا و قیمت مناسب و سرعت کامل، مجموعه‌ی %s در خدمت شما عزیزان می‌باشد.", brandName)
}

func getTermsText() string {
	customTerms := GetSetting("terms_message", "")
	if strings.TrimSpace(customTerms) != "" {
		return customTerms
	}
	brandName := GetSetting("brand_name", "گارد")
	hourlyFee := GetSetting("hourly_fee", "۱۳۸")
	minPrice := GetSetting("min_price_per_gb", "۴۱۵۰")
	maxPrice := GetSetting("max_price_per_gb", "۵۰۰۰")

	return fmt.Sprintf(`پرداخت فقط به اندازه مصرف 🫀
%s با مدل Pay As You Go کار می‌کند؛ یعنی لازم نیست از قبل حجم مشخصی خریداری کنید یا بابت حجم استفاده‌نشده هزینه‌ای بپردازید. هزینه شما فقط بر اساس ترافیک واقعی مصرف‌شده محاسبه می‌شود؛ هرچه کمتر مصرف کنید، کمتر پرداخت می‌کنید.

قیمت شفاف و متناسب با سرویس 🫀
هر سرویس قیمت مصرف مخصوص به خود را دارد و در حال حاضر هزینه هر گیگابایت بین %s تا %s تومان است. قیمت دقیق هر سرویس و کانفیگ را می‌توانید مستقیماً از بخش‌های Configs و Subscriptions در پنل مدیریت مشاهده کنید؛ بنابراین قبل از ارائه هر سرویس، دقیقاً می‌دانید هزینه مصرف آن چقدر است.

بدون محدودیت و تعهد حجمی 🫀
در %s خبری از سقف حجم، محدودیت زمانی یا محدودیت تعداد کاربر نیست. می‌توانید بدون نگرانی از تمام شدن حجم یا نیاز به تمدید اشتراک، سرویس خود را در هر مقیاسی که نیاز دارید ارائه کنید و هزینه را متناسب با مصرف واقعی پرداخت کنید.

هزینه نمایندگی؛ ساده و ثابت 🫀
برای هر پنل، مبلغ %s تومان به ازای هر ساعت بابت نمایندگی دریافت می‌شود. این مبلغ مستقل از تعداد کاربران و میزان مصرف است و تنها برای جلوگیری از ایجاد پنل‌های صوری و بدون استفاده در نظر گرفته شده است.

یک سیستم شفاف، بدون هزینه‌های پنهان 🫀
در نهایت، هزینه شما فقط شامل ترافیک مصرف‌شده بر اساس سرویس انتخابی + هزینه ساعتی نمایندگی پنل است. بدون خرید حجم اجباری، بدون هزینه اشتراک حجمی و بدون محدودیت برای رشد پنل.`,
		brandName, minPrice, maxPrice, brandName, hourlyFee)
}

func getWalletText(u *User) string {
	return fmt.Sprintf("💰 <b>کیف پول شما</b>\n\n💵 <b>موجودی فعلی:</b> %s تومان", formatCurrency(u.WalletBalance))
}

func getMyPanelsText(u *User) string {
	if u.PanelUsername == "" || u.ServiceStatus == "none" {
		return "📦 <b>هنوز اشتراکی نداری.</b>\n\nاز دکمه «خرید اشتراک» می‌تونی اشتراک جدید بگیری."
	}
	passLine := ""
	if u.PanelPassword != "" {
		passLine = fmt.Sprintf("🔑 <b>کلمه عبور:</b> <code>%s</code>\n", u.PanelPassword)
	}
	urlLine := ""
	if u.SubURL != "" {
		urlLine = fmt.Sprintf("🌐 <b>آدرس پنل:</b> <code>%s</code>\n", u.SubURL)
	}
	statusText := "فعال ✅"
	if u.ServiceStatus == "disabled" {
		statusText = "غیرفعال (اتمام موجودی) ⚠️"
	}
	return fmt.Sprintf("🌐 <b>پنل‌های من</b>\n\n👤 <b>نام کاربری:</b> <code>%s</code>\n%s%s⚡ <b>وضعیت:</b> %s\n💰 <b>موجودی کیف پول:</b> <code>%s تومان</code>",
		u.PanelUsername, passLine, urlLine, statusText, formatCurrency(u.WalletBalance))
}

// -------------------------------------------------------------
// Update & Callback Handling
// -------------------------------------------------------------

func (s *Service) handleUpdate(ctx context.Context, u Update) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("[SalesBot] Panic recovered in handleUpdate: %v\n", r)
		}
	}()

	if u.CallbackQuery != nil {
		s.handleCallback(ctx, u.CallbackQuery)
		return
	}
	if u.Message == nil {
		return
	}

	msg := u.Message
	var userID int64
	var username, firstName string
	if msg.From != nil {
		userID = msg.From.ID
		username = msg.From.Username
		firstName = msg.From.FirstName
	} else if msg.Chat.ID != 0 {
		userID = msg.Chat.ID
		username = msg.Chat.Username
		firstName = msg.Chat.FirstName
	} else {
		return
	}

	user, err := GetOrCreateUser(userID, username, firstName)
	if err != nil {
		fmt.Printf("[SalesBot] ERROR GetOrCreateUser for tgID %d: %v\n", userID, err)
		user = &User{
			TelegramID:    userID,
			Username:      username,
			FirstName:     firstName,
			WalletBalance: 0,
			ServiceStatus: "none",
			CreatedAt:     time.Now(),
		}
	}

	// Check if user uploaded a receipt photo
	if len(msg.Photo) > 0 {
		s.handleReceiptPhoto(ctx, msg, user)
		return
	}

	text := strings.TrimSpace(msg.Text)
	if text == "" {
		return
	}

	state, _ := GetUserState(userID)

	switch {
	case strings.HasPrefix(text, "/start") || text == "منوی اصلی" || text == "منو" || text == "شروع":
		ClearUserState(userID)
		s.tgClient.RemoveReplyKeyboard(ctx, s.botToken, userID)
		s.sendWelcome(ctx, user)

	case text == "⚡ شارژ کیف پول (پرداخت ۵ دقیقه‌ای)":
		ClearUserState(userID)
		s.tgClient.RemoveReplyKeyboard(ctx, s.botToken, userID)
		text := "💳 <b>افزایش موجودی کیف پول</b>\n\nلطفاً روش واریز مورد نظر خود را انتخاب نمایید:"
		_ = s.tgClient.SendMessage(ctx, s.botToken, userID, text, depositKeyboard())

	case text == "📊 وضعیت اشتراک و اعتبار":
		ClearUserState(userID)
		s.tgClient.RemoveReplyKeyboard(ctx, s.botToken, userID)
		hasPanel := user.PanelUsername != "" && user.ServiceStatus == "active"
		_ = s.tgClient.SendMessage(ctx, s.botToken, userID, getMyPanelsText(user), myPanelsKeyboard(hasPanel, user.SubURL))

	case text == "💳 ارسال فیش کارت به کارت":
		ClearUserState(userID)
		s.tgClient.RemoveReplyKeyboard(ctx, s.botToken, userID)
		SetUserState(user.TelegramID, "awaiting_receipt_amount", "")
		s.promptReceipt(ctx, user)

	case text == "📖 راهنمای اتصال" || text == "📞 پشتیبانی" || text == "پشتیبانی":
		ClearUserState(userID)
		s.tgClient.RemoveReplyKeyboard(ctx, s.botToken, userID)
		supportUser := GetSetting("support_username", "@AdminSupport")
		channelUser := GetSetting("channel_username", "")
		text := fmt.Sprintf(
			"📮 <b>پشتیبانی و ارتباط با ما:</b>\n\n"+
				"در صورت بروز هرگونه سوال یا مشکل با آیدی زیر در ارتباط باشید:\n"+
				"👉 <b>%s</b>\n\n",
			supportUser,
		)
		if channelUser != "" {
			text += fmt.Sprintf("📢 <b>کانال اطلاع‌رسانی:</b>\n👉 <b>%s</b>\n", channelUser)
		}
		_ = s.tgClient.SendMessage(ctx, s.botToken, userID, text, backKeyboard())

	case state == "awaiting_amount":
		s.processChargeAmount(ctx, user, text)

	case state == "awaiting_receipt_amount":
		s.processReceiptAmount(ctx, user, text)

	case state == "awaiting_gift_code":
		s.processGiftCode(ctx, user, text)

	default:
		s.tgClient.RemoveReplyKeyboard(ctx, s.botToken, userID)
		s.sendWelcome(ctx, user)
	}
}

func (s *Service) editOrSend(ctx context.Context, chatID, messageID int64, text string, replyMarkup any) {
	if messageID > 0 {
		err := s.tgClient.EditMessageText(ctx, s.botToken, chatID, messageID, text, replyMarkup)
		if err == nil {
			return
		}
	}
	_ = s.tgClient.SendMessage(ctx, s.botToken, chatID, text, replyMarkup)
}

func (s *Service) handleCallback(ctx context.Context, cb *CallbackQuery) {
	_ = s.tgClient.AnswerCallbackQuery(ctx, s.botToken, cb.ID, "")

	var chatID, messageID int64
	if cb.Message != nil {
		chatID = cb.Message.Chat.ID
		messageID = cb.Message.MessageID
	} else {
		chatID = cb.From.ID
	}

	user, err := GetOrCreateUser(cb.From.ID, cb.From.Username, cb.From.FirstName)
	if err != nil {
		user = &User{TelegramID: cb.From.ID, FirstName: cb.From.FirstName, WalletBalance: 0}
	}

	data := cb.Data

	switch data {
	case "main_menu":
		ClearUserState(user.TelegramID)
		s.editOrSend(ctx, chatID, messageID, getWelcomeText(user), mainInlineKeyboard())

	case "buy_panel":
		ClearUserState(user.TelegramID)
		s.editOrSend(ctx, chatID, messageID, getTermsText(), buyPanelKeyboard())

	case "confirm_buy_panel":
		ClearUserState(user.TelegramID)
		minBalance := GetSettingFloat("min_balance_to_start", 5000)
		if minBalance <= 0 {
			minBalance = 5000
		}

		if user.WalletBalance < minBalance {
			text := fmt.Sprintf(
				"⚠️ <b>موجودی کیف پول شما کافی نیست.</b>\n\n"+
					"برای راه‌اندازی و فعال‌سازی پنل نمایندگی، حداقل موجودی اولیه <code>%s تومان</code> مورد نیاز است.\n\n"+
					"💵 <b>موجودی فعلی شما:</b> <code>%s تومان</code>\n\n"+
					"لطفاً ابتدا از دکمه «افزایش موجودی» نسبت به شارژ کیف پول خود اقدام فرمایید.",
				formatCurrency(minBalance), formatCurrency(user.WalletBalance),
			)
			s.editOrSend(ctx, chatID, messageID, text, depositOnlyKeyboard())
			return
		}

		adminUser, adminPass, panelURL, isUpgrade, err := CreatePurchasedAdmin(ctx, user.TelegramID, user.FirstName)
		if err != nil {
			fmt.Printf("[SalesBot] ERROR CreatePurchasedAdmin for tgID %d: %v\n", user.TelegramID, err)
			text := "❌ <b>خطا در راه‌اندازی پنل نمایندگی</b>\n\nمتأسفانه در اتصال به سیستم یا ساخت اکانت خطایی رخ داد. لطفاً چند لحظه بعد مجدداً تلاش فرمایید یا با پشتیبانی در ارتباط باشید."
			s.editOrSend(ctx, chatID, messageID, text, backKeyboard())
			return
		}

		user.PanelUsername = adminUser
		if adminPass != "" {
			user.PanelPassword = adminPass
		}
		user.SubURL = panelURL
		user.ServiceStatus = "active"

		panelDisplay := panelURL
		if panelDisplay == "" {
			panelDisplay = "پنل مدیریت DarkPanel"
		}

		pricePerGB := GetSettingFloat("price_per_gb", 5000)

		passLine := ""
		if user.PanelPassword != "" {
			passLine = fmt.Sprintf("🔑 <b>کلمه عبور:</b> <code>%s</code>\n", user.PanelPassword)
		}

		title := "🎉 <b>پنل نمایندگی شما با موفقیت راه‌اندازی شد!</b>"
		if isUpgrade {
			title = "🎉 <b>پنل شما با موفقیت به پلن دائمی (Pay As You Go) ارتقا یافت!</b>"
		}

		text := fmt.Sprintf(
			"%s\n\n"+
				"📋 <b>مشخصات ورود به پنل مدیریت:</b>\n"+
				"🌐 <b>آدرس پنل:</b> <code>%s</code>\n"+
				"👤 <b>نام کاربری:</b> <code>%s</code>\n"+
				"%s\n"+
				"💰 <b>موجودی فعلی کیف پول:</b> <code>%s تومان</code>\n"+
				"⚡ <b>مدل تعرفه:</b> پرداخت به اندازه مصرف (Pay As You Go)\n"+
				"💵 <b>هزینه هر گیگابایت:</b> %s تومان\n\n"+
				"💡 <i>راهنما: ترافیک مصرفی کاربران شما به‌صورت خودکار و دقیق محاسبه شده و متناسب با مصرف از کیف پول کسر می‌شود.</i>",
			title, panelDisplay, adminUser, passLine,
			formatCurrency(user.WalletBalance), formatCurrency(pricePerGB),
		)
		s.editOrSend(ctx, chatID, messageID, text, myPanelsKeyboard(true, panelURL))

	case "wallet":
		ClearUserState(user.TelegramID)
		s.editOrSend(ctx, chatID, messageID, getWalletText(user), walletKeyboard())

	case "my_panels":
		ClearUserState(user.TelegramID)
		hasPanel := user.PanelUsername != "" && user.ServiceStatus == "active"
		s.editOrSend(ctx, chatID, messageID, getMyPanelsText(user), myPanelsKeyboard(hasPanel, user.SubURL))

	case "test_panel":
		ClearUserState(user.TelegramID)
		if user.HasUsedTest {
			text := "🔒 <b>تو سقف دریافت نمایندگی تست را پر کرده‌ای.</b>\n\nهر کاربر تنها ۱ بار امکان دریافت پنل نمایندگی تست را دارد.\nدر صورتی که نیاز به پنل جدید دارید می‌توانید از منوی اصلی اقدام به خرید نمایید یا با پشتیبانی در تماس باشید."
			s.editOrSend(ctx, chatID, messageID, text, backKeyboard())
			return
		}

		adminUser, adminPass, panelURL, err := CreateTestAdmin(ctx, user.TelegramID, user.FirstName)
		if err != nil {
			fmt.Printf("[SalesBot] ERROR CreateTestAdmin for tgID %d: %v\n", user.TelegramID, err)
			text := "❌ <b>خطا در ایجاد پنل نمایندگی تست</b>\n\nمتأسفانه در اتصال به سیستم یا ساخت اکانت خطایی رخ داد. لطفاً چند لحظه بعد مجدداً تلاش فرمایید یا با پشتیبانی در ارتباط باشید."
			s.editOrSend(ctx, chatID, messageID, text, backKeyboard())
			return
		}

		user.HasUsedTest = true
		user.PanelUsername = adminUser
		user.PanelPassword = adminPass
		user.SubURL = panelURL
		user.ServiceStatus = "active"

		panelDisplay := panelURL
		if panelDisplay == "" {
			panelDisplay = "پنل مدیریت DarkPanel"
		}

		text := fmt.Sprintf(
			"🧪 <b>پنل نمایندگی تست شما با موفقیت فعال شد!</b>\n\n"+
				"📋 <b>مشخصات ورود به پنل مدیریت:</b>\n"+
				"🌐 <b>آدرس پنل:</b> <code>%s</code>\n"+
				"👤 <b>نام کاربری:</b> <code>%s</code>\n"+
				"🔑 <b>کلمه عبور:</b> <code>%s</code>\n\n"+
				"📦 <b>میزان ترافیک:</b> ۵ گیگابایت (5 GB)\n"+
				"⏳ <b>مدت اعتبار:</b> ۱ روز (۲۴ ساعت)\n"+
				"🛡️ <b>نوع دسترسی:</b> نماینده (Reseller)\n\n"+
				"💡 <i>راهنما: وارد آدرس پنل شوید و با نام کاربری و کلمه عبور بالا لاگین فرمایید. شما دسترسی ساخت کاربر و تست کانفیگ‌ها را خواهید داشت.</i>",
			panelDisplay, adminUser, adminPass,
		)
		s.editOrSend(ctx, chatID, messageID, text, testPanelSuccessKeyboard(panelURL))

	case "deposit":
		ClearUserState(user.TelegramID)
		text := "💳 <b>افزایش موجودی کیف پول</b>\n\nلطفاً روش واریز مورد نظر خود را انتخاب نمایید:"
		s.editOrSend(ctx, chatID, messageID, text, depositKeyboard())

	case "deposit_5min":
		SetUserState(user.TelegramID, "awaiting_amount", "")
		text := "⚡ <b>کارت به کارت خودکار (شناسایی ۵ دقیقه‌ای)</b>\n\n" +
			"لطفاً مبلغ مورد نظر خود را به تومان ارسال فرمایید:\n" +
			"(مثال: <code>50000</code> یا <code>100000</code>)"
		s.editOrSend(ctx, chatID, messageID, text, backKeyboard())

	case "deposit_receipt":
		SetUserState(user.TelegramID, "awaiting_receipt_amount", "")
		s.promptReceipt(ctx, user)

	case "gift_code":
		SetUserState(user.TelegramID, "awaiting_gift_code", "")
		text := "🎉 <b>اعمال کد هدیه</b>\n\nلطفاً کد هدیه خود را در چت ارسال نمایید:"
		s.editOrSend(ctx, chatID, messageID, text, backKeyboard())

	case "support":
		ClearUserState(user.TelegramID)
		supportUser := GetSetting("support_username", "@AdminSupport")
		channelUser := GetSetting("channel_username", "")
		text := fmt.Sprintf(
			"📮 <b>پشتیبانی و ارتباط با ما:</b>\n\n"+
				"در صورت بروز هرگونه سوال یا مشکل با آیدی زیر در ارتباط باشید:\n"+
				"👉 <b>%s</b>\n\n",
			supportUser,
		)
		if channelUser != "" {
			text += fmt.Sprintf("📢 <b>کانال اطلاع‌رسانی:</b>\n👉 <b>%s</b>\n", channelUser)
		}
		s.editOrSend(ctx, chatID, messageID, text, backKeyboard())
	}
}

func (s *Service) sendWelcome(ctx context.Context, u *User) {
	s.tgClient.RemoveReplyKeyboard(ctx, s.botToken, u.TelegramID)
	text := getWelcomeText(u)
	if err := s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, text, mainInlineKeyboard()); err != nil {
		fmt.Printf("[SalesBot] Failed to send welcome message to %d: %v\n", u.TelegramID, err)
	}
}

func (s *Service) processChargeAmount(ctx context.Context, u *User, input string) {
	amountBase, err := parseAmount(input)
	if err != nil || amountBase < 10000 {
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "⚠️ لطفاً یک مبلغ معتبر (حداقل ۱۰,۰۰۰ تومان) به عدد وارد کنید:", backKeyboard())
		return
	}

	order, err := Generate5MinOrder(u.TelegramID, amountBase)
	if err != nil {
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "⚠️ خطا در ایجاد فاکتور موقت. لطفاً مجدداً تلاش کنید.", backKeyboard())
		return
	}

	ClearUserState(u.TelegramID)

	cardNumber := GetSetting("card_number", "در پنل تنظیم نشده است")
	cardHolder := GetSetting("card_holder", "")
	bankName := GetSetting("bank_name", "")

	text := fmt.Sprintf(
		"⏱️ <b>فاکتور پرداخت موقت (مهلت ۵ دقیقه)</b>\n\n"+
			"🔴 <b>مبلغ دقیق جهت انتقال (الزامی):</b>\n"+
			"👉 <code>%s</code> تومان\n\n"+
			"⚠️ <b>توجه بسیار مهم:</b>\n"+
			"سیستم برای شناسایی خودکار واریز شما، ۳ رقم آخر را به صورت اختصاصی <b>%s</b> تنظیم کرده است. <b>دقیقاً همین مبلغ %s تومان را کارت به کارت کنید</b> تا بلافاصله شارژ شوید.\n\n"+
			"💳 <b>اطلاعات کارت بانکی مقصد:</b>\n"+
			"شماره کارت: <code>%s</code>\n"+
			"به نام: <b>%s</b>\n"+
			"بانک: <b>%s</b>\n\n"+
			"⏳ <b>مهلت پرداخت:</b> ۵ دقیقه\n"+
			"پس از انتقال، پیامک بانک به صورت خودکار شناسایی شده و کیف پول شما طی چند ثانیه شارژ خواهد شد. نیازی به ارسال فیش نیست!",
		formatCurrency(order.AmountExact),
		order.Code,
		formatCurrency(order.AmountExact),
		cardNumber,
		cardHolder,
		bankName,
	)

	_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, text, backKeyboard())
}

func (s *Service) processGiftCode(ctx context.Context, u *User, input string) {
	ClearUserState(u.TelegramID)
	amt, err := RedeemGiftCode(u.TelegramID, input)
	if err != nil {
		text := fmt.Sprintf("❌ <b>خطا در اعمال کد هدیه:</b>\n%v", err)
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, text, backKeyboard())
		return
	}

	u.WalletBalance += amt
	text := fmt.Sprintf(
		"🎉 <b>کد هدیه با موفقیت اعمال شد!</b>\n\n"+
			"مبلغ <b>%s تومان</b> به کیف پول شما افزوده شد.\n\n"+
			"💰 <b>موجودی فعلی کیف پول شما:</b> <code>%s تومان</code>",
		formatCurrency(amt),
		formatCurrency(u.WalletBalance),
	)
	_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, text, walletKeyboard())
}

func (s *Service) promptReceipt(ctx context.Context, u *User) {
	cardNumber := GetSetting("card_number", "")
	cardHolder := GetSetting("card_holder", "")
	bankName := GetSetting("bank_name", "")

	text := fmt.Sprintf(
		"💳 <b>واریز کارت به کارت دستی (با ارسال عکس فیش)</b>\n\n"+
			"شماره کارت: <code>%s</code>\n"+
			"صاحب حساب: <b>%s</b>\n"+
			"بانک: <b>%s</b>\n\n"+
			"مرحله ۱: ابتدا مبلغی که واریز کرده‌اید را به تومان وارد کنید:",
		cardNumber, cardHolder, bankName,
	)

	_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, text, backKeyboard())
}

func (s *Service) processReceiptAmount(ctx context.Context, u *User, input string) {
	amt, err := parseAmount(input)
	if err != nil || amt < 5000 {
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "⚠️ لطفاً یک مبلغ معتبر وارد کنید:", backKeyboard())
		return
	}

	SetUserState(u.TelegramID, "awaiting_receipt_photo", fmt.Sprintf("%.0f", amt))
	_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "📸 مرحله ۲: اکنون تصویر فیش واریزی خود را ارسال فرمایید:", backKeyboard())
}

func (s *Service) handleReceiptPhoto(ctx context.Context, msg *Message, u *User) {
	if len(msg.Photo) == 0 {
		return
	}
	state, data := GetUserState(u.TelegramID)
	if state != "awaiting_receipt_photo" {
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "لطفاً ابتدا از منوی اصلی گزینه افزایش موجودی و سپس ارسال فیش را انتخاب کنید.", backKeyboard())
		return
	}

	amt, _ := strconv.ParseFloat(data, 64)
	if amt <= 0 {
		amt = 50000
	}

	fileID := msg.Photo[len(msg.Photo)-1].FileID

	db, _, err := GetDB()
	if err != nil {
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "خطا در ثبت فیش.", backKeyboard())
		return
	}

	_, err = db.Exec(`
		INSERT INTO receipts (user_id, amount, file_id, status, created_at)
		VALUES (?, ?, ?, 'pending', ?)`,
		u.TelegramID, amt, fileID, time.Now().Format("2006-01-02 15:04:05"),
	)
	if err != nil {
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "خطا در ذخیره فیش.", backKeyboard())
		return
	}

	ClearUserState(u.TelegramID)

	_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "✅ <b>فیش شما با موفقیت ثبت شد و برای مدیریت ارسال گردید.</b>\nپس از تایید، موجودی کیف پول شما افزایش خواهد یافت.", mainInlineKeyboard())
}
