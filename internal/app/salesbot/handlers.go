package salesbot

import (
	"context"
	"fmt"
	"html"
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

func mainKeyboard() ReplyKeyboardMarkup {
	return ReplyKeyboardMarkup{
		Keyboard: [][]KeyboardButton{
			{
				{Text: "⚡ شارژ کیف پول (پرداخت ۵ دقیقه‌ای)"},
				{Text: "📊 وضعیت اشتراک و اعتبار"},
			},
			{
				{Text: "💳 ارسال فیش کارت به کارت"},
				{Text: "📖 راهنمای اتصال"},
			},
			{
				{Text: "📞 پشتیبانی"},
			},
		},
		ResizeKeyboard: true,
		IsPersistent:   true,
	}
}

func (s *Service) handleUpdate(ctx context.Context, u Update) {
	if u.CallbackQuery != nil {
		s.handleCallback(ctx, u.CallbackQuery)
		return
	}
	if u.Message == nil {
		return
	}

	msg := u.Message
	userID := msg.From.ID
	username := msg.From.Username
	firstName := msg.From.FirstName

	user, err := GetOrCreateUser(userID, username, firstName)
	if err != nil {
		return
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
	case strings.HasPrefix(text, "/start") || text == "منوی اصلی" || text == "منو":
		ClearUserState(userID)
		s.sendWelcome(ctx, user)

	case text == "⚡ شارژ کیف پول (پرداخت ۵ دقیقه‌ای)":
		SetUserState(userID, "awaiting_amount", "")
		s.promptChargeAmount(ctx, user)

	case text == "📊 وضعیت اشتراک و اعتبار":
		ClearUserState(userID)
		s.sendUserStatus(ctx, user)

	case text == "💳 ارسال فیش کارت به کارت":
		SetUserState(userID, "awaiting_receipt_amount", "")
		s.promptReceipt(ctx, user)

	case text == "📖 راهنمای اتصال":
		ClearUserState(userID)
		s.sendGuide(ctx, user)

	case text == "📞 پشتیبانی":
		ClearUserState(userID)
		s.sendSupport(ctx, user)

	case state == "awaiting_amount":
		s.processChargeAmount(ctx, user, text)

	case state == "awaiting_receipt_amount":
		s.processReceiptAmount(ctx, user, text)

	default:
		s.sendWelcome(ctx, user)
	}
}

func (s *Service) sendWelcome(ctx context.Context, u *User) {
	pricePerGB := GetSettingFloat("price_per_gb", 5000)
	minBalance := GetSettingFloat("min_balance_to_start", 5000)

	displayName := html.EscapeString(u.FirstName)
	if strings.TrimSpace(displayName) == "" {
		displayName = "کاربر"
	}

	text := fmt.Sprintf(
		"سلام <b>%s</b> عزیز 👋\n\n"+
			"به ربات خرید و شارژ خودکار اینترنت آزاد خوش آمدید 🚀\n\n"+
			"💎 <b>سیستم محاسبه Pay-As-You-Go (پرداخت به میزان مصرف):</b>\n"+
			"🔹 نرخ هر گیگابایت ترافیک: <code>%s تومان</code>\n"+
			"🔹 حداقل موجودی کیف پول جهت اتصال: <code>%s تومان</code>\n\n"+
			"💰 <b>موجودی فعلی کیف پول شما:</b> <code>%s تومان</code>\n\n"+
			"جهت افزایش موجودی و دریافت یا تمدید اشتراک، از دکمه‌های زیر استفاده کنید:",
		displayName,
		formatCurrency(pricePerGB),
		formatCurrency(minBalance),
		formatCurrency(u.WalletBalance),
	)

	if err := s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, text, mainKeyboard()); err != nil {
		fmt.Printf("[SalesBot] Failed to send welcome message to %d: %v\n", u.TelegramID, err)
	}
}

func (s *Service) promptChargeAmount(ctx context.Context, u *User) {
	text := "💳 <b>شارژ خودکار کیف پول (روش کارت به کارت هوشمند)</b>\n\n" +
		"لطفاً مبلغ مورد نظر خود را به تومان وارد کنید:\n" +
		"(یا یکی از مبالغ آماده زیر را تایپ نمایید)\n\n" +
		"▫️ <code>50000</code> تومان (۱۰ گیگ)\n" +
		"▫️ <code>100000</code> تومان (۲۰ گیگ)\n" +
		"▫️ <code>200000</code> تومان (۴۰ گیگ)\n\n" +
		"<i>سیستم به صورت خودکار ۳ رقم آخر را تصادفی تغییر می‌دهد تا پس از کارت به کارت، پیامک بانک سریعاً تطبیق داده شده و بدون نیاز به ارسال فیش کیف پول شارژ شود.</i>"

	_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, text, nil)
}

func (s *Service) processChargeAmount(ctx context.Context, u *User, input string) {
	amountBase, err := parseAmount(input)
	if err != nil || amountBase < 10000 {
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "⚠️ لطفاً یک مبلغ معتبر (حداقل ۱۰,۰۰۰ تومان) به عدد وارد کنید:", nil)
		return
	}

	order, err := Generate5MinOrder(u.TelegramID, amountBase)
	if err != nil {
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "⚠️ خطا در ایجاد فاکتور موقت. لطفاً مجدداً تلاش کنید.", nil)
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

	_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, text, mainKeyboard())
}

func (s *Service) sendUserStatus(ctx context.Context, u *User) {
	pricePerGB := GetSettingFloat("price_per_gb", 5000)
	var estGB float64
	if pricePerGB > 0 {
		estGB = u.WalletBalance / pricePerGB
	}

	statusText := "فعال ✅"
	if u.ServiceStatus == "suspended" || u.WalletBalance < GetSettingFloat("min_balance_to_start", 5000) {
		statusText = "معلق (نیازمند شارژ) ⚠️"
	} else if u.ServiceStatus == "none" {
		statusText = "بدون اشتراک فعال ❌"
	}

	text := fmt.Sprintf(
		"📊 <b>اطلاعات حساب و وضعیت اشتراک:</b>\n\n"+
			"👤 نام کاربر: %s\n"+
			"🆔 شناسه کاربری: <code>%d</code>\n"+
			"💰 موجودی کیف پول: <code>%s تومان</code>\n"+
			"📶 ترافیک قابل استفاده معادل: <b>%.2f گیگابایت</b>\n"+
			"⚡ وضعیت دسترسی: <b>%s</b>\n\n",
		u.FirstName,
		u.TelegramID,
		formatCurrency(u.WalletBalance),
		estGB,
		statusText,
	)

	if u.SubURL != "" {
		text += fmt.Sprintf("🔗 <b>لینک سابسکریپشن شما:</b>\n<code>%s</code>\n\n<i>این لینک را در نرم‌افزارهای V2rayNG, Happ, v2box کپی و ایمپورت نمایید.</i>", u.SubURL)
	}

	_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, text, mainKeyboard())
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

	_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, text, nil)
}

func (s *Service) processReceiptAmount(ctx context.Context, u *User, input string) {
	amt, err := parseAmount(input)
	if err != nil || amt < 5000 {
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "⚠️ لطفاً یک مبلغ معتبر وارد کنید:", nil)
		return
	}

	SetUserState(u.TelegramID, "awaiting_receipt_photo", fmt.Sprintf("%.0f", amt))
	_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "📸 مرحله ۲: اکنون تصویر فیش واریزی خود را ارسال کنید:", nil)
}

func (s *Service) handleReceiptPhoto(ctx context.Context, msg *Message, u *User) {
	state, data := GetUserState(u.TelegramID)
	if state != "awaiting_receipt_photo" {
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "لطفاً ابتدا از منوی اصلی گزینه ارسال فیش را انتخاب کنید.", nil)
		return
	}

	amt, _ := strconv.ParseFloat(data, 64)
	if amt <= 0 {
		amt = 50000
	}

	fileID := msg.Photo[len(msg.Photo)-1].FileID

	db, _, err := GetDB()
	if err != nil {
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "خطا در ثبت فیش.", nil)
		return
	}

	_, err = db.Exec(`
		INSERT INTO receipts (user_id, amount, file_id, status, created_at)
		VALUES (?, ?, ?, 'pending', ?)`,
		u.TelegramID, amt, fileID, time.Now().Format("2006-01-02 15:04:05"),
	)
	if err != nil {
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "خطا در ذخیره فیش.", nil)
		return
	}

	ClearUserState(u.TelegramID)

	_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, "✅ فیش شما با موفقیت ثبت شد و برای مدیریت ارسال گردید. پس از تایید موجودی کیف پول شما افزایش خواهد یافت.", mainKeyboard())
}

func (s *Service) sendGuide(ctx context.Context, u *User) {
	text := "📖 <b>راهنمای اتصال به اینترنت آزاد:</b>\n\n" +
		"1️⃣ نرم‌افزار متناسب با سیستم‌عامل خود را نصب کنید:\n" +
		"▫️ اندروید: V2rayNG یا Happ\n" +
		"▫️ آیفون (iOS): v2box یا Streisand یا Foxray\n" +
		"▫️ ویندوز: V2rayN یا Nekoray\n\n" +
		"2️⃣ لینک سابسکریپشن خود را از بخش «وضعیت اشتراک» کپی کنید.\n" +
		"3️⃣ در نرم‌افزار گزینه Add from clipboard یا Update Subscription را بزنید و متصل شوید!"

	_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, text, mainKeyboard())
}

func (s *Service) sendSupport(ctx context.Context, u *User) {
	supportUser := GetSetting("support_username", "@AdminSupport")
	channelUser := GetSetting("channel_username", "")

	text := fmt.Sprintf(
		"📞 <b>پشتیبانی و ارتباط با ما:</b>\n\n"+
			"در صورت بروز هرگونه سوال یا مشکل با آیدی زیر در ارتباط باشید:\n"+
			"👉 <b>%s</b>\n\n",
		supportUser,
	)
	if channelUser != "" {
		text += fmt.Sprintf("📢 کانال اطلاع‌رسانی:\n👉 <b>%s</b>\n", channelUser)
	}

	_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, text, mainKeyboard())
}

func (s *Service) handleCallback(ctx context.Context, cb *CallbackQuery) {
	_ = s.tgClient.AnswerCallbackQuery(ctx, s.botToken, cb.ID, "درحال پردازش...")
}
