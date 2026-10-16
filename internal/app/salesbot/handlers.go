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
	return renderBotKeyboard("main_menu", &kbCtx{})
}

func mainKeyboard() InlineKeyboardMarkup {
	return mainInlineKeyboard()
}

func buyPanelKeyboard() InlineKeyboardMarkup {
	return renderBotKeyboard("buy_intro", &kbCtx{})
}

func walletKeyboard() InlineKeyboardMarkup {
	return renderBotKeyboard("wallet_menu", &kbCtx{})
}

func canUserTakeTest(user *User) bool {
	if user == nil {
		return false
	}
	testEnabled := GetSetting("test_panel_enabled", "true")
	if testEnabled == "false" || testEnabled == "0" {
		return false
	}
	maxTests := GetSettingInt("test_limit_per_user", 1)
	if maxTests <= 0 {
		return true
	}
	if user.HasUsedTest || user.TestUsageCount >= maxTests {
		return false
	}
	return true
}

func getEmptyPanelsText(canTakeTest bool) string {
	if canTakeTest {
		return getBotMessage("panels_empty", nil)
	}
	return getBotMessage("panels_empty_no_test", nil)
}

func emptyPanelsKeyboard(canTakeTest bool) InlineKeyboardMarkup {
	return renderBotKeyboard("empty_panels", &kbCtx{CanTakeTest: canTakeTest})
}

func panelDetailKeyboard(panel UserPanel, canCreateMore bool, totalPanels int) InlineKeyboardMarkup {
	return renderBotKeyboard("panel_detail", &kbCtx{
		Panel:         &panel,
		PanelURL:      panel.PanelURL,
		CanCreateMore: canCreateMore,
		TotalPanels:   totalPanels,
	})
}

func panelsListKeyboard(panels []UserPanel, canCreateMore bool) InlineKeyboardMarkup {
	return renderPanelsList(&kbCtx{Panels: panels, CanCreateMore: canCreateMore})
}

func changePassKeyboard(panelID int64) InlineKeyboardMarkup {
	return renderBotKeyboard("change_pass", &kbCtx{PanelID: panelID})
}

func passChangedKeyboard(panel UserPanel) InlineKeyboardMarkup {
	return renderBotKeyboard("pass_changed", &kbCtx{Panel: &panel, PanelURL: panel.PanelURL})
}

func confirmDeleteKeyboard(panelID int64) InlineKeyboardMarkup {
	return renderBotKeyboard("confirm_delete", &kbCtx{PanelID: panelID})
}

func myPanelsKeyboard(hasPanel bool, panelURL string, canTakeTest ...bool) InlineKeyboardMarkup {
	if !hasPanel {
		canTest := false
		if len(canTakeTest) > 0 {
			canTest = canTakeTest[0]
		}
		return emptyPanelsKeyboard(canTest)
	}
	return renderBotKeyboard("my_panels", &kbCtx{PanelURL: panelURL})
}

func testPanelSuccessKeyboard(panelURL string) InlineKeyboardMarkup {
	return renderBotKeyboard("test_success", &kbCtx{PanelURL: panelURL})
}

func depositOnlyKeyboard() InlineKeyboardMarkup {
	return renderBotKeyboard("deposit_only", &kbCtx{})
}

func settingOn(key string, defaultOn bool) bool {
	val := strings.ToLower(strings.TrimSpace(GetSetting(key, "")))
	if val == "" {
		return defaultOn
	}
	switch val {
	case "true", "1", "yes", "on":
		return true
	}
	return false
}

func depositKeyboard() InlineKeyboardMarkup {
	return renderBotKeyboard("deposit_menu", &kbCtx{})
}

// buildCryptoWalletsText renders the configured crypto wallet addresses.
func buildCryptoWalletsText() string {
	tether := strings.TrimSpace(GetSetting("tether_wallet", ""))
	ton := strings.TrimSpace(GetSetting("ton_wallet", ""))
	var sb strings.Builder
	sb.WriteString("🪙 <b>پرداخت با رمزارز</b>\n\n")
	if tether != "" {
		sb.WriteString("💵 <b>تتر (USDT - TRC20):</b>\n")
		sb.WriteString(fmt.Sprintf("<code>%s</code>\n\n", tether))
	}
	if ton != "" {
		sb.WriteString("💎 <b>تون (TON):</b>\n")
		sb.WriteString(fmt.Sprintf("<code>%s</code>\n\n", ton))
	}
	sb.WriteString("⚠️ پس از انتقال، تصویر رسید تراکنش را همراه با مبلغ به پشتیبانی ارسال فرمایید تا کیف پول شما شارژ شود.")
	return sb.String()
}

// notifyAdmins sends a plain notification to every configured admin id.
func (s *Service) notifyAdmins(ctx context.Context, text string) {
	raw := strings.TrimSpace(GetSetting("admin_ids", ""))
	if raw == "" {
		return
	}
	token := s.botToken
	if token == "" {
		token = GetSetting("bot_token", "")
	}
	if token == "" {
		return
	}
	for _, part := range strings.FieldsFunc(raw, func(r rune) bool { return r == ',' || r == ';' || r == ' ' || r == '\n' }) {
		id, err := strconv.ParseInt(strings.TrimSpace(part), 10, 64)
		if err != nil || id <= 0 {
			continue
		}
		go func(adminID int64) {
			notifyCtx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
			defer cancel()
			_ = s.tgClient.SendMessage(notifyCtx, token, adminID, text, nil)
		}(id)
	}
}

func backKeyboard() InlineKeyboardMarkup {
	return renderBotKeyboard("back_menu", &kbCtx{})
}

// -------------------------------------------------------------
// Text Templates
// -------------------------------------------------------------

func getWelcomeText(u *User) string {
	return getBotMessage("welcome", baseBotVars(u))
}

func getTermsText() string {
	pricePerGB := GetSettingFloat("price_per_gb", 5000)
	if pricePerGB <= 0 {
		pricePerGB = 5000
	}
	return getBotMessage("terms", mergeVars(baseBotVars(nil), map[string]string{
		"price_per_gb": formatCurrency(pricePerGB),
	}))
}

func getWalletText(u *User) string {
	return getBotMessage("wallet", baseBotVars(u))
}

func formatPanelDetail(user *User, panel *UserPanel) string {
	passLine := ""
	if panel.PanelPassword != "" {
		passLine = fmt.Sprintf("🔑 <b>کلمه عبور:</b> <code>%s</code>\n", panel.PanelPassword)
	}
	typeDesc := "نمایندگی Pay-As-You-Go ⭐"
	if panel.PanelType == "test" {
		typeDesc = "نمایندگی تست موقت 🧪"
	}
	statusDesc := "فعال ✅"
	if panel.Status == "disabled" {
		statusDesc = "غیرفعال (اتمام موجودی) ⚠️"
	}
	return fmt.Sprintf(
		"🌐 <b>مدیریت پنل: <code>%s</code></b>\n\n"+
			"👤 <b>نام کاربری:</b> <code>%s</code>\n"+
			"%s"+
			"🏷️ <b>نوع دسترسی:</b> %s\n"+
			"⚡ <b>وضعیت:</b> %s\n"+
			"💰 <b>موجودی کیف پول:</b> <code>%s تومان</code>\n\n"+
			"<i>💡 جهت ورود، تغییر رمز یا حذف این پنل از دکمه‌های زیر استفاده فرمایید:</i>",
		panel.PanelUsername, panel.PanelUsername,
		passLine, typeDesc, statusDesc,
		formatCurrency(user.WalletBalance),
	)
}

func formatPanelsList(user *User, panels []UserPanel) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("🌐 <b>پنل‌های من (%d پنل)</b>\n\n", len(panels)))
	sb.WriteString("📋 <b>لیست پنل‌های نمایندگی شما:</b>\n\n")
	for i, p := range panels {
		st := "فعال ✅"
		if p.Status == "disabled" {
			st = "غیرفعال ⚠️"
		}
		tDesc := "Pay-As-You-Go"
		if p.PanelType == "test" {
			tDesc = "تست"
		}
		sb.WriteString(fmt.Sprintf("%d. 👤 <code>%s</code> | %s (%s)\n", i+1, p.PanelUsername, st, tDesc))
	}
	sb.WriteString(fmt.Sprintf("\n💰 <b>موجودی کل کیف پول:</b> <code>%s تومان</code>\n\n", formatCurrency(user.WalletBalance)))
	sb.WriteString("👇 <b>جهت مشاهده مشخصات، تغییر رمز، ورود به درگاه یا حذف، روی پنل مورد نظر کلیک فرمایید:</b>")
	return sb.String()
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

	if !s.channelAllows(ctx, userID) {
		s.sendJoinRequired(ctx, userID)
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

	state, stateData := GetUserState(userID)

	switch {
	case strings.HasPrefix(text, "/start") || text == "منوی اصلی" || text == "منو" || text == "شروع":
		ClearUserState(userID)
		s.tgClient.RemoveReplyKeyboard(ctx, s.botToken, userID)
		s.sendWelcome(ctx, user)

	case text == "⚡ شارژ کیف پول (پرداخت ۵ دقیقه‌ای)":
		ClearUserState(userID)
		s.tgClient.RemoveReplyKeyboard(ctx, s.botToken, userID)
		text := getBotMessage("deposit_menu", nil)
		_ = s.tgClient.SendMessage(ctx, s.botToken, userID, text, depositKeyboard())

	case text == "📊 وضعیت اشتراک و اعتبار" || text == "🌐 پنل‌های من" || text == "پنل‌های من":
		ClearUserState(userID)
		s.tgClient.RemoveReplyKeyboard(ctx, s.botToken, userID)
		panels, _ := GetUserPanels(user.TelegramID)
		if len(panels) == 0 {
			canTest := canUserTakeTest(user)
			_ = s.tgClient.SendMessage(ctx, s.botToken, userID,
				getEmptyPanelsText(canTest),
				emptyPanelsKeyboard(canTest))
		} else if len(panels) == 1 {
			maxPanels := GetMaxPanelsPerUser()
			canCreate := maxPanels == 0 || len(panels) < maxPanels
			_ = s.tgClient.SendMessage(ctx, s.botToken, userID, formatPanelDetail(user, &panels[0]), panelDetailKeyboard(panels[0], canCreate, len(panels)))
		} else {
			maxPanels := GetMaxPanelsPerUser()
			canCreate := maxPanels == 0 || len(panels) < maxPanels
			_ = s.tgClient.SendMessage(ctx, s.botToken, userID, formatPanelsList(user, panels), panelsListKeyboard(panels, canCreate))
		}

	case text == "💳 ارسال فیش کارت به کارت":
		ClearUserState(userID)
		s.tgClient.RemoveReplyKeyboard(ctx, s.botToken, userID)
		SetUserState(user.TelegramID, "awaiting_receipt_amount", "")
		s.promptReceipt(ctx, user)

	case text == "📖 راهنمای اتصال" || text == "📞 پشتیبانی" || text == "پشتیبانی":
		ClearUserState(userID)
		s.tgClient.RemoveReplyKeyboard(ctx, s.botToken, userID)
		channelUser := GetSetting("channel_username", "")
		text := getBotMessage("support", baseBotVars(user))
		if channelUser != "" {
			text += getBotMessage("support_channel", baseBotVars(user))
		}
		_ = s.tgClient.SendMessage(ctx, s.botToken, userID, text, backKeyboard())

	case state == "awaiting_amount":
		s.processChargeAmount(ctx, user, text)

	case state == "awaiting_receipt_amount":
		s.processReceiptAmount(ctx, user, text)

	case state == "awaiting_gift_code":
		s.processGiftCode(ctx, user, text)

	case state == "awaiting_new_password":
		s.processNewPassword(ctx, user, stateData, text)

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
	userID := cb.From.ID

	if cb.Data == "check_membership" {
		resetJoinCache(userID)
		if !s.channelAllows(ctx, userID) {
			_ = s.tgClient.AnswerCallbackQuery(ctx, s.botToken, cb.ID, "❌ هنوز عضو کانال نشده‌اید!")
			return
		}
		_ = s.tgClient.AnswerCallbackQuery(ctx, s.botToken, cb.ID, "✅ عضویت شما تایید شد")
		user, err := GetOrCreateUser(userID, cb.From.Username, cb.From.FirstName)
		if err != nil {
			return
		}
		s.sendWelcome(ctx, user)
		return
	}

	if !s.channelAllows(ctx, userID) {
		_ = s.tgClient.AnswerCallbackQuery(ctx, s.botToken, cb.ID, "")
		s.sendJoinRequired(ctx, userID)
		return
	}

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
		maxPanels := GetMaxPanelsPerUser()
		activeCount := GetUserActivePanelCount(user.TelegramID)
		if maxPanels > 0 && activeCount >= maxPanels {
			text := getBotMessage("buy_limit_reached", mergeVars(baseBotVars(user), map[string]string{
				"active_panels": strconv.Itoa(activeCount),
				"max_panels":    strconv.Itoa(maxPanels),
			}))
			s.editOrSend(ctx, chatID, messageID, text, InlineKeyboardMarkup{
				InlineKeyboard: [][]InlineKeyboardButton{
					{{Text: "🌐 پنل‌های من", CallbackData: "my_panels"}},
					{{Text: "🔙 بازگشت به منو", CallbackData: "main_menu"}},
				},
			})
			return
		}

		minBalance := GetSettingFloat("min_balance_to_start", 5000)
		if minBalance <= 0 {
			minBalance = 5000
		}

		if user.WalletBalance < minBalance {
			text := getBotMessage("buy_low_balance", mergeVars(baseBotVars(user), map[string]string{
				"min_balance": formatCurrency(minBalance),
				"balance":     formatCurrency(user.WalletBalance),
			}))
			s.editOrSend(ctx, chatID, messageID, text, depositOnlyKeyboard())
			return
		}

		adminUser, adminPass, panelURL, isUpgrade, err := CreatePurchasedAdmin(ctx, user.TelegramID, user.FirstName)
		if err != nil {
			if err.Error() == "MAX_LIMIT_REACHED" {
				text := getBotMessage("buy_limit_reached_short", mergeVars(baseBotVars(user), map[string]string{
					"max_panels": strconv.Itoa(maxPanels),
				}))
				s.editOrSend(ctx, chatID, messageID, text, backKeyboard())
				return
			}
			fmt.Printf("[SalesBot] ERROR CreatePurchasedAdmin for tgID %d: %v\n", user.TelegramID, err)
			text := getBotMessage("buy_error", baseBotVars(user))
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
				"🌐 <b>درگاه ورود به پنل:</b> <code>%s</code>\n"+
				"👤 <b>نام کاربری:</b> <code>%s</code>\n"+
				"%s\n"+
				"💰 <b>موجودی فعلی کیف پول:</b> <code>%s تومان</code>\n"+
				"⚡ <b>مدل تعرفه:</b> پرداخت به اندازه مصرف (Pay As You Go)\n"+
				"💵 <b>هزینه هر گیگابایت:</b> %s تومان\n\n"+
				"💡 <i>راهنما: ترافیک مصرفی کاربران شما به‌صورت خودکار محاسبه شده و از کیف پول کسر می‌شود.</i>",
			title, panelDisplay, adminUser, passLine,
			formatCurrency(user.WalletBalance), formatCurrency(pricePerGB),
		)

		var successButtons [][]InlineKeyboardButton
		if panelURL != "" && (strings.HasPrefix(panelURL, "http://") || strings.HasPrefix(panelURL, "https://")) {
			successButtons = append(successButtons, []InlineKeyboardButton{
				{Text: "🌐 ورود به درگاه پنل", URL: panelURL},
			})
		}
		successButtons = append(successButtons, []InlineKeyboardButton{
			{Text: "🌐 پنل‌های من", CallbackData: "my_panels"},
			{Text: "🏠 منوی اصلی", CallbackData: "main_menu"},
		})
		s.editOrSend(ctx, chatID, messageID, text, InlineKeyboardMarkup{InlineKeyboard: successButtons})

	case "wallet":
		ClearUserState(user.TelegramID)
		s.editOrSend(ctx, chatID, messageID, getWalletText(user), walletKeyboard())

	case "my_panels":
		ClearUserState(user.TelegramID)
		panels, err := GetUserPanels(user.TelegramID)
		if err != nil || len(panels) == 0 {
			canTest := canUserTakeTest(user)
			s.editOrSend(ctx, chatID, messageID, getEmptyPanelsText(canTest), emptyPanelsKeyboard(canTest))
			return
		}

		maxPanels := GetMaxPanelsPerUser()
		canCreateMore := maxPanels == 0 || len(panels) < maxPanels

		if len(panels) == 1 {
			s.editOrSend(ctx, chatID, messageID, formatPanelDetail(user, &panels[0]), panelDetailKeyboard(panels[0], canCreateMore, len(panels)))
			return
		}

		s.editOrSend(ctx, chatID, messageID, formatPanelsList(user, panels), panelsListKeyboard(panels, canCreateMore))

	case "test_panel":
		ClearUserState(user.TelegramID)
		testEnabled := GetSetting("test_panel_enabled", "true")
		if testEnabled == "false" || testEnabled == "0" {
			s.editOrSend(ctx, chatID, messageID, getBotMessage("test_disabled", baseBotVars(user)), backKeyboard())
			return
		}

		maxPanels := GetMaxPanelsPerUser()
		activeCount := GetUserActivePanelCount(user.TelegramID)
		if maxPanels > 0 && activeCount >= maxPanels {
			text := getBotMessage("test_limit_panels", mergeVars(baseBotVars(user), map[string]string{
				"active_panels": strconv.Itoa(activeCount),
				"max_panels":    strconv.Itoa(maxPanels),
			}))
			s.editOrSend(ctx, chatID, messageID, text, backKeyboard())
			return
		}

		maxTests := GetSettingInt("test_limit_per_user", 1)
		if maxTests <= 0 {
			maxTests = 1
		}

		if user.TestUsageCount >= maxTests || (maxTests == 1 && user.HasUsedTest) {
			text := getBotMessage("test_limit_reached", mergeVars(baseBotVars(user), map[string]string{
				"test_limit": strconv.Itoa(maxTests),
			}))
			s.editOrSend(ctx, chatID, messageID, text, backKeyboard())
			return
		}

		adminUser, adminPass, panelURL, err := CreateTestAdmin(ctx, user.TelegramID, user.FirstName)
		if err != nil {
			if err.Error() == "MAX_LIMIT_REACHED" {
				text := getBotMessage("test_limit_panels_short", mergeVars(baseBotVars(user), map[string]string{
					"max_panels": strconv.Itoa(maxPanels),
				}))
				s.editOrSend(ctx, chatID, messageID, text, backKeyboard())
				return
			}
			fmt.Printf("[SalesBot] ERROR CreateTestAdmin for tgID %d: %v\n", user.TelegramID, err)
			text := getBotMessage("test_error", baseBotVars(user))
			s.editOrSend(ctx, chatID, messageID, text, backKeyboard())
			return
		}

		user.HasUsedTest = true
		user.TestUsageCount++
		user.PanelUsername = adminUser
		user.PanelPassword = adminPass
		user.SubURL = panelURL
		user.ServiceStatus = "active"

		panelDisplay := panelURL
		if panelDisplay == "" {
			panelDisplay = "پنل مدیریت DarkPanel"
		}

		testGB := GetSettingFloat("test_traffic_gb", 5)
		if testGB <= 0 {
			testGB = 5
		}
		durationHours := GetSettingInt("test_duration_hours", 24)
		if durationHours <= 0 {
			durationHours = 24
		}

		durationStr := fmt.Sprintf("%d ساعت", durationHours)
		if durationHours >= 24 && durationHours%24 == 0 {
			durationStr = fmt.Sprintf("%d روز (%d ساعت)", durationHours/24, durationHours)
		}

		text := fmt.Sprintf(
			"🧪 <b>پنل نمایندگی تست شما با موفقیت فعال شد!</b>\n\n"+
				"📋 <b>مشخصات ورود به پنل مدیریت:</b>\n"+
				"🌐 <b>درگاه ورود به پنل:</b> <code>%s</code>\n"+
				"👤 <b>نام کاربری:</b> <code>%s</code>\n"+
				"🔑 <b>کلمه عبور:</b> <code>%s</code>\n\n"+
				"📦 <b>میزان ترافیک:</b> %s گیگابایت\n"+
				"⏳ <b>مدت اعتبار:</b> %s\n"+
				"🎁 <b>هزینه:</b> رایگان (بدون کسر از موجودی کیف پول)\n"+
				"🛡️ <b>نوع دسترسی:</b> نماینده (Reseller)\n\n"+
				"💡 <i>راهنما: وارد آدرس پنل شوید و با مشخصات بالا لاگین فرمایید.</i>",
			panelDisplay, adminUser, adminPass,
			strconv.FormatFloat(testGB, 'f', -1, 64), durationStr,
		)
		s.editOrSend(ctx, chatID, messageID, text, testPanelSuccessKeyboard(panelURL))

	case "deposit":
		ClearUserState(user.TelegramID)
		text := getBotMessage("deposit_menu", nil)
		s.editOrSend(ctx, chatID, messageID, text, depositKeyboard())

	case "deposit_5min":
		if !settingOn("deposit_5min_enabled", true) {
			s.editOrSend(ctx, chatID, messageID, getBotMessage("deposit_method_disabled", baseBotVars(user)), backKeyboard())
			return
		}
		SetUserState(user.TelegramID, "awaiting_amount", "")
		text := "⚡ <b>کارت به کارت خودکار (شناسایی ۵ دقیقه‌ای)</b>\n\n" +
			"لطفاً مبلغ مورد نظر خود را به تومان ارسال فرمایید:\n" +
			"(مثال: <code>50000</code> یا <code>100000</code>)"
		s.editOrSend(ctx, chatID, messageID, text, backKeyboard())

	case "deposit_receipt":
		if !settingOn("deposit_receipt_enabled", true) {
			s.editOrSend(ctx, chatID, messageID, getBotMessage("deposit_method_disabled", baseBotVars(user)), backKeyboard())
			return
		}
		SetUserState(user.TelegramID, "awaiting_receipt_amount", "")
		s.promptReceipt(ctx, user)

	case "deposit_crypto":
		if !settingOn("deposit_crypto_enabled", true) ||
			(strings.TrimSpace(GetSetting("tether_wallet", "")) == "" && strings.TrimSpace(GetSetting("ton_wallet", "")) == "") {
			s.editOrSend(ctx, chatID, messageID, getBotMessage("deposit_method_disabled", baseBotVars(user)), backKeyboard())
			return
		}
		ClearUserState(user.TelegramID)
		s.editOrSend(ctx, chatID, messageID, buildCryptoWalletsText(), backKeyboard())

	case "gift_code":
		SetUserState(user.TelegramID, "awaiting_gift_code", "")
		text := "🎉 <b>اعمال کد هدیه</b>\n\nلطفاً کد هدیه خود را در چت ارسال نمایید:"
		s.editOrSend(ctx, chatID, messageID, text, backKeyboard())

	case "support":
		ClearUserState(user.TelegramID)
		channelUser := GetSetting("channel_username", "")
		text := getBotMessage("support", baseBotVars(user))
		if channelUser != "" {
			text += getBotMessage("support_channel", baseBotVars(user))
		}
		s.editOrSend(ctx, chatID, messageID, text, backKeyboard())

	default:
		switch {
		case strings.HasPrefix(data, "view_panel:"):
			parts := strings.Split(data, ":")
			if len(parts) == 2 {
				panelID, _ := strconv.ParseInt(parts[1], 10, 64)
				panel, err := GetUserPanelByID(user.TelegramID, panelID)
				if err != nil || panel == nil {
					s.editOrSend(ctx, chatID, messageID, "❌ پنل مورد نظر یافت نشد.", backKeyboard())
					return
				}
				maxPanels := GetMaxPanelsPerUser()
				count := GetUserActivePanelCount(user.TelegramID)
				canCreateMore := maxPanels == 0 || count < maxPanels
				s.editOrSend(ctx, chatID, messageID, formatPanelDetail(user, panel), panelDetailKeyboard(*panel, canCreateMore, count))
			}

		case strings.HasPrefix(data, "chpass:"):
			parts := strings.Split(data, ":")
			if len(parts) == 2 {
				panelID, _ := strconv.ParseInt(parts[1], 10, 64)
				panel, err := GetUserPanelByID(user.TelegramID, panelID)
				if err != nil || panel == nil {
					s.editOrSend(ctx, chatID, messageID, "❌ پنل مورد نظر یافت نشد.", backKeyboard())
					return
				}
				text := fmt.Sprintf(
					"🔑 <b>تغییر کلمه عبور پنل <code>%s</code></b>\n\n"+
						"لطفاً روش تغییر رمز را انتخاب فرمایید:\n\n"+
						"🎲 <b>ساخت رمز عبور تصادفی:</b> یک رمز قدرتمند جدید بلافاصله تولید و ثبت می‌شود.\n"+
						"✏️ <b>تایپ رمز دلخواه:</b> می‌توانید کلمه عبور دلخواه خود را در ربات ارسال فرمایید.",
					panel.PanelUsername,
				)
				s.editOrSend(ctx, chatID, messageID, text, changePassKeyboard(panelID))
			}

		case strings.HasPrefix(data, "gen_pass:"):
			parts := strings.Split(data, ":")
			if len(parts) == 2 {
				panelID, _ := strconv.ParseInt(parts[1], 10, 64)
				newPass := generateRandomPassword(10)
				panel, err := ChangeAdminPassword(ctx, user.TelegramID, panelID, newPass)
				if err != nil {
					s.editOrSend(ctx, chatID, messageID, "❌ خطا در تغییر کلمه عبور: "+err.Error(), backKeyboard())
					return
				}
				panelDisplay := panel.PanelURL
				if panelDisplay == "" {
					panelDisplay = "پنل مدیریت DarkPanel"
				}
				text := fmt.Sprintf(
					"✅ <b>کلمه عبور با موفقیت تغییر کرد!</b>\n\n"+
						"👤 <b>نام کاربری:</b> <code>%s</code>\n"+
						"🔑 <b>کلمه عبور جدید:</b> <code>%s</code>\n"+
						"🌐 <b>درگاه ورود به پنل:</b> <code>%s</code>\n\n"+
						"<i>اکنون می‌توانید با کلمه عبور جدید وارد درگاه پنل شوید.</i>",
					panel.PanelUsername, newPass, panelDisplay,
				)
				s.editOrSend(ctx, chatID, messageID, text, passChangedKeyboard(*panel))
			}

		case strings.HasPrefix(data, "input_pass:"):
			parts := strings.Split(data, ":")
			if len(parts) == 2 {
				panelID, _ := strconv.ParseInt(parts[1], 10, 64)
				panel, err := GetUserPanelByID(user.TelegramID, panelID)
				if err != nil || panel == nil {
					s.editOrSend(ctx, chatID, messageID, "❌ پنل مورد نظر یافت نشد.", backKeyboard())
					return
				}
				SetUserState(user.TelegramID, "awaiting_new_password", fmt.Sprintf("%d", panelID))
				text := fmt.Sprintf(
					"✏️ <b>ارسال کلمه عبور دلخواه برای پنل <code>%s</code></b>\n\n"+
						"لطفاً کلمه عبور جدید مورد نظر خود را تایپ و ارسال فرمایید:\n"+
						"(حداقل ۶ کاراکتر)",
					panel.PanelUsername,
				)
				s.editOrSend(ctx, chatID, messageID, text, InlineKeyboardMarkup{
					InlineKeyboard: [][]InlineKeyboardButton{
						{{Text: "🔙 انصراف و بازگشت", CallbackData: fmt.Sprintf("view_panel:%d", panelID)}},
					},
				})
			}

		case strings.HasPrefix(data, "delpanel:"):
			parts := strings.Split(data, ":")
			if len(parts) == 2 {
				panelID, _ := strconv.ParseInt(parts[1], 10, 64)
				panel, err := GetUserPanelByID(user.TelegramID, panelID)
				if err != nil || panel == nil {
					s.editOrSend(ctx, chatID, messageID, "❌ پنل مورد نظر یافت نشد.", backKeyboard())
					return
				}
				typeDesc := "نمایندگی Pay-As-You-Go ⭐"
				if panel.PanelType == "test" {
					typeDesc = "نمایندگی تست موقت 🧪"
				}
				text := fmt.Sprintf(
					"⚠️ <b>تأیید نهایی حذف پنل نمایندگی</b>\n\n"+
						"👤 <b>نام کاربری:</b> <code>%s</code>\n"+
						"🏷️ <b>نوع پنل:</b> %s\n\n"+
						"🚨 <b>هشدار جدی:</b> با حذف این پنل، اکانت نماینده و تمامی کاربران ساخته شده در آن برای همیشه حذف خواهند شد و این عملیات <b>غیرقابل بازگشت</b> است.\n\n"+
						"آیا از حذف این پنل اطمینان دارید؟",
					panel.PanelUsername, typeDesc,
				)
				s.editOrSend(ctx, chatID, messageID, text, confirmDeleteKeyboard(panelID))
			}

		case strings.HasPrefix(data, "confirm_del:"):
			parts := strings.Split(data, ":")
			if len(parts) == 2 {
				panelID, _ := strconv.ParseInt(parts[1], 10, 64)
				delUsername, err := DeleteAdminPanel(ctx, user.TelegramID, panelID)
				if err != nil {
					s.editOrSend(ctx, chatID, messageID, "❌ خطا در حذف پنل: "+err.Error(), backKeyboard())
					return
				}
				text := fmt.Sprintf(
					"✅ <b>پنل <code>%s</code> با موفقیت حذف گردید.</b>\n\n"+
						"کلیه دسترسی‌های این پنل پاک شدند.",
					delUsername,
				)
				canTest := canUserTakeTest(user)
				s.editOrSend(ctx, chatID, messageID, text, emptyPanelsKeyboard(canTest))
			}
		}
	}
}

func (s *Service) processNewPassword(ctx context.Context, u *User, panelIDStr, newPassInput string) {
	panelID, _ := strconv.ParseInt(strings.TrimSpace(panelIDStr), 10, 64)
	newPass := strings.TrimSpace(newPassInput)
	if len(newPass) < 6 {
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID,
			"⚠️ <b>کلمه عبور باید حداقل ۶ کاراکتر باشد.</b>\n\nلطفاً کلمه عبور دیگری ارسال فرمایید:",
			InlineKeyboardMarkup{
				InlineKeyboard: [][]InlineKeyboardButton{
					{{Text: "🔙 انصراف و بازگشت", CallbackData: fmt.Sprintf("view_panel:%d", panelID)}},
				},
			})
		return
	}

	ClearUserState(u.TelegramID)
	panel, err := ChangeAdminPassword(ctx, u.TelegramID, panelID, newPass)
	if err != nil {
		_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID,
			"❌ <b>خطا در تغییر کلمه عبور:</b> "+err.Error(),
			backKeyboard())
		return
	}

	panelDisplay := panel.PanelURL
	if panelDisplay == "" {
		panelDisplay = "پنل مدیریت DarkPanel"
	}
	successText := fmt.Sprintf(
		"✅ <b>کلمه عبور با موفقیت تغییر کرد!</b>\n\n"+
			"👤 <b>نام کاربری:</b> <code>%s</code>\n"+
			"🔑 <b>کلمه عبور جدید:</b> <code>%s</code>\n"+
			"🌐 <b>درگاه ورود به پنل:</b> <code>%s</code>\n\n"+
			"<i>اکنون می‌توانید با کلمه عبور جدید وارد درگاه پنل شوید.</i>",
		panel.PanelUsername, newPass, panelDisplay,
	)
	_ = s.tgClient.SendMessage(ctx, s.botToken, u.TelegramID, successText, passChangedKeyboard(*panel))
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
	shabaNumber := strings.TrimSpace(GetSetting("shaba_number", ""))
	shabaLine := ""
	if shabaNumber != "" {
		shabaLine = fmt.Sprintf("شبا: <code>%s</code>\n", shabaNumber)
	}

	rialAmount := order.AmountExact * 10

	text := fmt.Sprintf(
		"⏱️ <b>فاکتور پرداخت (اعتبار ۵ دقیقه)</b>\n\n"+
			"🔴 <b>مبلغ دقیق جهت انتقال:</b>\n"+
			"<code>%s</code> ریال\n"+
			"<i>(معادل %s تومان)</i>\n"+
			"<i>(روی مبلغ بزنید تا کپی شود)</i>\n\n"+
			"⚠️ <b>مبلغ را دقیقاً تا ریال آخر واریز کنید.</b>\n\n"+
			"💳 <b>اطلاعات کارت بانکی مقصد:</b>\n"+
			"شماره کارت: <code>%s</code>\n"+
			"به نام: <b>%s</b>\n"+
			"بانک: <b>%s</b>\n"+
			"%s\n"+
			"⏳ <b>مهلت پرداخت:</b> ۵ دقیقه",
		formatCurrency(rialAmount),
		formatCurrency(order.AmountExact),
		cardNumber,
		cardHolder,
		bankName,
		shabaLine,
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
	shabaNumber := strings.TrimSpace(GetSetting("shaba_number", ""))
	shabaLine := ""
	if shabaNumber != "" {
		shabaLine = fmt.Sprintf("شبا: <code>%s</code>\n", shabaNumber)
	}

	text := fmt.Sprintf(
		"💳 <b>واریز کارت به کارت دستی (با ارسال عکس فیش)</b>\n\n"+
			"شماره کارت: <code>%s</code>\n"+
			"صاحب حساب: <b>%s</b>\n"+
			"بانک: <b>%s</b>\n"+
			"%s\n"+
			"مرحله ۱: ابتدا مبلغی که واریز کرده‌اید را به تومان وارد کنید:",
		cardNumber, cardHolder, bankName, shabaLine,
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

	// Notify configured admins so pending receipts can be reviewed quickly.
	who := u.FirstName
	if who == "" {
		who = fmt.Sprintf("%d", u.TelegramID)
	}
	if u.Username != "" {
		who = fmt.Sprintf("%s (@%s)", who, u.Username)
	}
	s.notifyAdmins(ctx, fmt.Sprintf(
		"🧾 <b>فیش کارت به کارت جدید</b>\n\n"+
			"👤 کاربر: <b>%s</b>\n"+
			"📱 آیدی: <code>%d</code>\n"+
			"💰 مبلغ اعلامی: <b>%s تومان</b>\n\n"+
			"جهت تایید یا رد، وارد پنل مدیریت → ربات فروش → فیش‌های کارت به کارت شوید.",
		who, u.TelegramID, formatCurrency(amt),
	))
}
