package handlers

import (
	"fmt"
	"log"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"darkpanel-bot/database"
	"darkpanel-bot/keyboards"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

func (h *BotHandler) handleCallback(query *tgbotapi.CallbackQuery) {
	data := query.Data
	tgID := query.From.ID

	// Always answer callback query to clear loading spinner
	defer func() {
		callback := tgbotapi.NewCallback(query.ID, "")
		_, _ = h.bot.Request(callback)
	}()

	switch {
	case data == "pay_card":
		h.startCardPayment(query)
	case data == "pay_crypto":
		h.startCryptoPayment(query)
	case strings.HasPrefix(data, "cancel_order:"):
		h.handleCancelOrder(query)
	case strings.HasPrefix(data, "manual_receipt:"):
		h.handleManualReceiptPrompt(query)
	case strings.HasPrefix(data, "receipt_approve:"):
		h.handleReceiptApprove(query)
	case strings.HasPrefix(data, "receipt_reject:"):
		h.handleReceiptReject(query)
	case strings.HasPrefix(data, "adm_"):
		h.handleAdminCallback(query)
	default:
		log.Printf("Unknown callback data: %s from %d", data, tgID)
	}
}

func (h *BotHandler) startCardPayment(query *tgbotapi.CallbackQuery) {
	tgID := query.From.ID
	h.db.SetUserState(tgID, "waiting_card_amount", "")

	text := "💳 *افزایش موجودی از طریق کارت به کارت (تایید خودکار)*\n\n" +
		"لطفاً مبلغ مورد نظر جهت شارژ را به *تومان* ارسال نمایید (حداقل ۱۰,۰۰۰ تومان):\n" +
		"مثال: `100000` یا `50000`"

	m := tgbotapi.NewMessage(tgID, text)
	m.ParseMode = tgbotapi.ModeMarkdown
	m.ReplyMarkup = keyboards.CancelKeyboard()
	_, _ = h.bot.Send(m)
}

func (h *BotHandler) startCryptoPayment(query *tgbotapi.CallbackQuery) {
	tgID := query.From.ID

	trc20Wallet := h.db.GetSetting("crypto_wallet_trc20", "TNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
	tonWallet := h.db.GetSetting("crypto_wallet_ton", "UQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")

	text := fmt.Sprintf(
		"💎 *افزایش موجودی از طریق ارز دیجیتال (تتر / TON)*\n\n"+
			"🔹 *آدرس ولت Tether (TRC20):*\n`%s`\n\n"+
			"🔹 *آدرس ولت TON / USDT TON:*\n`%s`\n\n"+
			"📌 *راهنما:* پس از واریز مبلغ مورد نظر، تصویر رسید یا هش تراکنش (TxID) را به آی‌دی پشتیبانی ارسال کنید تا حساب شما فوراً شارژ گردد.",
		trc20Wallet, tonWallet,
	)

	m := tgbotapi.NewMessage(tgID, text)
	m.ParseMode = tgbotapi.ModeMarkdown
	_, _ = h.bot.Send(m)
}

func (h *BotHandler) handleCancelOrder(query *tgbotapi.CallbackQuery) {
	tgID := query.From.ID
	parts := strings.Split(query.Data, ":")
	if len(parts) >= 2 {
		orderID, _ := strconv.ParseInt(parts[1], 10, 64)
		_ = h.db.CancelUserPendingOrders(tgID)
		log.Printf("[Payments] User %d cancelled order #%d", tgID, orderID)
	}

	h.db.ClearUserState(tgID)
	edit := tgbotapi.NewEditMessageText(tgID, query.Message.MessageID, "❌ *سفارش پرداخت لغو گردید.*\nدر صورت تمایل می‌توانید مجدداً از منوی افزایش موجودی اقدام نمایید.")
	edit.ParseMode = tgbotapi.ModeMarkdown
	_, _ = h.bot.Send(edit)
}

func (h *BotHandler) handleManualReceiptPrompt(query *tgbotapi.CallbackQuery) {
	tgID := query.From.ID
	parts := strings.Split(query.Data, ":")
	var orderID int64
	if len(parts) >= 2 {
		orderID, _ = strconv.ParseInt(parts[1], 10, 64)
	}

	order, _ := h.db.GetOrder(orderID)
	amount := 0.0
	if order != nil {
		amount = order.AmountExact
	}

	h.db.SetUserState(tgID, "waiting_receipt_photo", fmt.Sprintf("%.0f", amount))
	m := tgbotapi.NewMessage(tgID, "📸 لطفاً *تصویر فیش واریزی* خود را ارسال فرمایید تا ادمین آن را به صورت دستی تایید کند:")
	m.ReplyMarkup = keyboards.CancelKeyboard()
	_, _ = h.bot.Send(m)
}

func (h *BotHandler) handleStateInput(msg *tgbotapi.Message, user *database.User, state, stateData string) {
	tgID := msg.From.ID

	switch state {
	case "waiting_card_amount":
		rawInput := strings.TrimSpace(msg.Text)
		cleanInput := strings.ReplaceAll(rawInput, ",", "")
		cleanInput = strings.ReplaceAll(cleanInput, "٬", "")
		cleanInput = strings.ReplaceAll(cleanInput, "،", "")
		cleanInput = normalizePersianDigits(cleanInput)

		amount, err := strconv.ParseFloat(cleanInput, 64)
		if err != nil || amount < 10000 {
			m := tgbotapi.NewMessage(tgID, "⚠️ لطفاً مبلغ را حداقل ۱۰,۰۰۰ تومان و به صورت عدد انگلیسی وارد کنید:\nمثال: `100000`")
			m.ReplyMarkup = keyboards.CancelKeyboard()
			_, _ = h.bot.Send(m)
			return
		}

		// Base amount rounded to thousands (e.g. 100,000)
		baseAmount := float64(int64(amount/1000) * 1000)
		if baseAmount < 10000 {
			baseAmount = 10000
		}

		// Generate random 3-digit number (100 to 999) without collision
		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		var exactAmount float64
		var code string
		for attempts := 0; attempts < 100; attempts++ {
			rnd := r.Intn(900) + 100 // 100..999
			candidate := baseAmount + float64(rnd)
			if !h.db.IsExactAmountTaken(candidate) {
				exactAmount = candidate
				code = fmt.Sprintf("%03d", rnd)
				break
			}
		}
		if exactAmount == 0 {
			rnd := r.Intn(900) + 100
			exactAmount = baseAmount + float64(rnd)
			code = fmt.Sprintf("%03d", rnd)
		}

		// Create 5-minute order
		order, err := h.db.CreateOrder(tgID, baseAmount, exactAmount, code, 5)
		if err != nil {
			log.Printf("[Payments] Error creating order: %v", err)
			_, _ = h.bot.Send(tgbotapi.NewMessage(tgID, "❌ خطایی در ثبت سفارش رخ داد. لطفاً مجدداً تلاش کنید."))
			h.db.ClearUserState(tgID)
			return
		}

		h.db.SetUserState(tgID, "waiting_auto_pay", fmt.Sprintf("%d", order.ID))

		cardNumber := h.db.GetSetting("card_number", "6037-9918-xxxx-xxxx")
		cardHolder := h.db.GetSetting("card_holder", "نام صاحب حساب")
		cardBank := h.db.GetSetting("card_bank", "بانک ملت")

		expiryTimeStr := order.ExpiresAt.Format("15:04:05")

		rialAmount := exactAmount * 10
		text := fmt.Sprintf(
			"💳 *درخواست پرداخت کارت به کارت (تایید خودکار ۵ دقیقه‌ای)*\n\n"+
				"⚠️ *توجه بسیار مهم:*\n"+
				"سیستم به صورت خودکار پیامک بانک را از طریق وب‌هوک بررسی می‌کند. برای اینکه واریز شما **آنی و بدون نیاز به تایید ادمین** تایید شود، باید **دقیقاً** مبلغ مشخص شده زیر را انتقال دهید:\n\n"+
				"💰 *مبلغ دقیق جهت واریز (به ریال):*\n"+
				"`%s` ریال\n"+
				"*(معادل %s تومان — روی عدد انگلیسی بالا بزنید تا کپی شود)*\n\n"+
				"⚠️ *مبلغ را دقیقاً تا ریال آخر واریز کنید.*\n\n"+
				"💳 *شماره کارت:*\n`%s`\n"+
				"👤 *صاحب حساب:* %s\n"+
				"🏦 *بانک:* %s\n\n"+
				"⏳ *مهلت پرداخت:* *۵ دقیقه* (تا ساعت `%s`)\n\n"+
				"⚡️ بلافاصله پس از انجام کارت به کارت، سیستم خودکار پیامک را تطبیق داده و کیف پول شما را شارژ می‌کند.",
			database.FormatMoney(rialAmount),
			database.FormatMoney(exactAmount),
			cardNumber,
			cardHolder,
			cardBank,
			expiryTimeStr,
		)

		m := tgbotapi.NewMessage(tgID, text)
		m.ParseMode = tgbotapi.ModeMarkdown

		inlineKbd := tgbotapi.NewInlineKeyboardMarkup(
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("❌ انصراف از پرداخت", fmt.Sprintf("cancel_order:%d", order.ID)),
			),
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("📸 ارسال تصویر فیش دستی", fmt.Sprintf("manual_receipt:%d", order.ID)),
			),
		)
		m.ReplyMarkup = inlineKbd
		_, _ = h.bot.Send(m)

	case "waiting_auto_pay":
		if len(msg.Photo) > 0 {
			// User sent a photo receipt for this order
			orderID, _ := strconv.ParseInt(stateData, 10, 64)
			order, _ := h.db.GetOrder(orderID)
			amount := 0.0
			if order != nil {
				amount = order.AmountExact
			}
			photos := msg.Photo
			bestPhoto := photos[len(photos)-1]
			receiptID, err := h.db.CreateReceipt(tgID, amount, bestPhoto.FileID)
			if err == nil {
				h.db.ClearUserState(tgID)
				h.sendMainMenu(tgID, user, "✅ *فیش واریزی شما با موفقیت ثبت شد.*\nپس از بررسی دستی توسط مدیریت، حساب شما شارژ خواهد شد.")
				h.notifyAdminReceipt(receiptID, tgID, amount, bestPhoto.FileID, msg.From)
			}
		} else {
			m := tgbotapi.NewMessage(tgID, "⏳ سفارش شما با مهلت ۵ دقیقه فعال است و سیستم منتظر پیامک واریزی است.\nبه محض کارت به کارت حساب شما خودکار شارژ می‌شود.")
			_, _ = h.bot.Send(m)
		}

	case "waiting_receipt_photo":
		if len(msg.Photo) == 0 {
			m := tgbotapi.NewMessage(tgID, "⚠️ لطفاً تصویر فیش واریزی را ارسال فرمایید (عکس فیش).")
			m.ReplyMarkup = keyboards.CancelKeyboard()
			_, _ = h.bot.Send(m)
			return
		}

		photos := msg.Photo
		bestPhoto := photos[len(photos)-1]
		fileID := bestPhoto.FileID

		amount, _ := strconv.ParseFloat(stateData, 64)
		receiptID, err := h.db.CreateReceipt(tgID, amount, fileID)
		if err != nil {
			log.Printf("Error creating receipt: %v", err)
			_, _ = h.bot.Send(tgbotapi.NewMessage(tgID, "❌ خطایی در ثبت فیش رخ داد. لطفاً مجدداً تلاش کنید."))
			h.db.ClearUserState(tgID)
			return
		}

		h.db.ClearUserState(tgID)
		h.sendMainMenu(tgID, user, "✅ *فیش واریزی شما با موفقیت ثبت شد.*\n\nپس از بررسی توسط مدیریت، حساب شما به صورت خودکار شارژ خواهد شد.")
		h.notifyAdminReceipt(receiptID, tgID, amount, fileID, msg.From)

	case "adm_waiting_price":
		h.handleAdminSetPriceInput(msg)
	case "adm_waiting_card":
		h.handleAdminSetCardInput(msg)
	case "adm_waiting_crypto":
		h.handleAdminSetCryptoInput(msg)
	case "adm_waiting_broadcast":
		h.handleAdminBroadcastInput(msg)
	}
}

func (h *BotHandler) handleReceiptApprove(query *tgbotapi.CallbackQuery) {
	if !h.cfg.IsAdmin(query.From.ID) {
		return
	}

	parts := strings.Split(query.Data, ":")
	if len(parts) < 3 {
		return
	}

	receiptID, _ := strconv.ParseInt(parts[1], 10, 64)
	amount, _ := strconv.ParseFloat(parts[2], 64)

	receipt, err := h.db.GetReceipt(receiptID)
	if err != nil || receipt == nil {
		return
	}

	if receipt.Status != "pending" {
		cb := tgbotapi.NewCallback(query.ID, "این فیش قبلاً تعیین وضعیت شده است.")
		_, _ = h.bot.Request(cb)
		return
	}

	_ = h.db.UpdateReceiptStatus(receiptID, "approved")
	newBalance, _ := h.db.UpdateWallet(receipt.UserID, amount)

	// Update admin message
	editedCaption := fmt.Sprintf(
		"✅ *فیش شماره #%d با موفقیت تایید شد.*\n\n"+
			"👤 کاربر: `%d`\n"+
			"💰 مبلغ شارژ شده: `%.0f` تومان\n"+
			"👨‍💼 توسط ادمین: %s",
		receiptID, receipt.UserID, amount, query.From.FirstName,
	)
	editMsg := tgbotapi.NewEditMessageCaption(query.Message.Chat.ID, query.Message.MessageID, editedCaption)
	editMsg.ParseMode = tgbotapi.ModeMarkdown
	_, _ = h.bot.Send(editMsg)

	// Send message to the user
	userMsg := fmt.Sprintf(
		"🎉 *فیش واریزی شما تایید شد!*\n\n"+
			"💰 مبلغ `%.0f` تومان به کیف پول شما اضافه گردید.\n"+
			"💳 موجودی فعلی: `%.0f` تومان\n\n"+
			"سرویس شما به صورت Pay-As-You-Go فعال است.",
		amount, newBalance,
	)
	_, _ = h.bot.Send(tgbotapi.NewMessage(receipt.UserID, userMsg))
}

func (h *BotHandler) handleReceiptReject(query *tgbotapi.CallbackQuery) {
	if !h.cfg.IsAdmin(query.From.ID) {
		return
	}

	parts := strings.Split(query.Data, ":")
	if len(parts) < 2 {
		return
	}

	receiptID, _ := strconv.ParseInt(parts[1], 10, 64)
	receipt, err := h.db.GetReceipt(receiptID)
	if err != nil || receipt == nil {
		return
	}

	if receipt.Status != "pending" {
		cb := tgbotapi.NewCallback(query.ID, "این فیش قبلاً تعیین وضعیت شده است.")
		_, _ = h.bot.Request(cb)
		return
	}

	_ = h.db.UpdateReceiptStatus(receiptID, "rejected")

	editedCaption := fmt.Sprintf(
		"❌ *فیش شماره #%d رد شد.*\n\n"+
			"👤 کاربر: `%d`\n"+
			"👨‍💼 توسط ادمین: %s",
		receiptID, receipt.UserID, query.From.FirstName,
	)
	editMsg := tgbotapi.NewEditMessageCaption(query.Message.Chat.ID, query.Message.MessageID, editedCaption)
	editMsg.ParseMode = tgbotapi.ModeMarkdown
	_, _ = h.bot.Send(editMsg)

	// Send message to user
	userMsg := fmt.Sprintf(
		"❌ *فیش واریزی شما (شماره #%d) توسط مدیریت تایید نشد.*\n\n"+
			"در صورت وجود هرگونه مغایرت، لطفاً به بخش پشتیبانی پیام دهید.",
		receiptID,
	)
	_, _ = h.bot.Send(tgbotapi.NewMessage(receipt.UserID, userMsg))
}

func (h *BotHandler) notifyAdminReceipt(receiptID int64, userID int64, amount float64, fileID string, user *tgbotapi.User) {
	name := user.FirstName
	if user.UserName != "" {
		name = fmt.Sprintf("%s (@%s)", name, user.UserName)
	}

	adminCaption := fmt.Sprintf(
		"🔔 *رسید جدید کارت به کارت*\n\n"+
			"🆔 شماره ثبت: `#%d`\n"+
			"👤 کاربر: %s\n"+
			"🔢 تلگرام آیدی: `%d`\n"+
			"💰 مبلغ اعلامی: `%s` تومان\n\n"+
			"جهت تایید یا رد فیش، یکی از گزینه‌های زیر را انتخاب نمایید:",
		receiptID, name, userID, database.FormatMoney(amount),
	)

	for _, adminID := range h.cfg.AdminIDs {
		photoMsg := tgbotapi.NewPhoto(adminID, tgbotapi.FileID(fileID))
		photoMsg.Caption = adminCaption
		photoMsg.ParseMode = tgbotapi.ModeMarkdown
		photoMsg.ReplyMarkup = keyboards.AdminReceiptApprovalInline(receiptID, amount)
		_, _ = h.bot.Send(photoMsg)
	}
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

