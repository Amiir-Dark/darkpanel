package handlers

import (
	"fmt"
	"log"
	"strconv"
	"strings"

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

	text := "💳 *افزایش موجودی از طریق کارت به کارت*\n\n" +
		"لطفاً مبلغ مورد نظر جهت شارژ را به *تومان* ارسال نمایید (فقط عدد، حداقل ۱۰۰۰۰ تومان):\n" +
		"مثال: `50000`"

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

func (h *BotHandler) handleStateInput(msg *tgbotapi.Message, user *database.User, state, stateData string) {
	tgID := msg.From.ID

	switch state {
	case "waiting_card_amount":
		amountStr := strings.TrimSpace(msg.Text)
		amount, err := strconv.ParseFloat(amountStr, 64)
		if err != nil || amount < 10000 {
			m := tgbotapi.NewMessage(tgID, "⚠️ لطفاً مبلغ را به صورت عدد انگلیسی و حداقل ۱۰,۰۰۰ تومان وارد کنید:")
			m.ReplyMarkup = keyboards.CancelKeyboard()
			_, _ = h.bot.Send(m)
			return
		}

		// Store amount in state and request receipt photo
		h.db.SetUserState(tgID, "waiting_receipt_photo", fmt.Sprintf("%.0f", amount))

		cardNumber := h.db.GetSetting("card_number", "6037-9918-xxxx-xxxx")
		cardHolder := h.db.GetSetting("card_holder", "نام صاحب حساب")
		cardShaba := h.db.GetSetting("card_shaba", "IRxxxxxxxxxxxxxxxxxxxxxx")

		text := fmt.Sprintf(
			"💳 *اطلاعات کارت جهت واریز مبلغ %.0f تومان:*\n\n"+
				"💳 *شماره کارت:*\n`%s`\n\n"+
				"👤 *صاحب حساب:* %s\n"+
				"🏦 *شماره شبا:* `%s`\n\n"+
				"📸 *مرحله بعد:* لطفاً پس از واریز، *تصویر فیش واریزی* را همینجا ارسال نمایید.",
			amount, cardNumber, cardHolder, cardShaba,
		)

		m := tgbotapi.NewMessage(tgID, text)
		m.ParseMode = tgbotapi.ModeMarkdown
		m.ReplyMarkup = keyboards.CancelKeyboard()
		_, _ = h.bot.Send(m)

	case "waiting_receipt_photo":
		if len(msg.Photo) == 0 {
			m := tgbotapi.NewMessage(tgID, "⚠️ لطفاً تصویر فیش واریزی را ارسال کنید (عکس فیش).")
			m.ReplyMarkup = keyboards.CancelKeyboard()
			_, _ = h.bot.Send(m)
			return
		}

		// Get highest resolution photo
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

		// Notify user
		h.sendMainMenu(tgID, user, "✅ *فیش واریزی شما با موفقیت ثبت شد.*\n\nپس از بررسی توسط مدیریت، حساب شما به صورت خودکار شارژ خواهد شد.")

		// Forward receipt photo to all admins
		adminCaption := fmt.Sprintf(
			"🔔 *رسید جدید کارت به کارت*\n\n"+
				"🆔 شماره ثبت: `#%d`\n"+
				"👤 کاربر: %s (@%s)\n"+
				"🔢 تلگرام آیدی: `%d`\n"+
				"💰 مبلغ اعلامی: `%.0f` تومان\n\n"+
				"جهت تایید یا رد فیش، یکی از گزینه‌های زیر را انتخاب نمایید:",
			receiptID, msg.From.FirstName, msg.From.UserName, tgID, amount,
		)

		for _, adminID := range h.cfg.AdminIDs {
			photoMsg := tgbotapi.NewPhoto(adminID, tgbotapi.FileID(fileID))
			photoMsg.Caption = adminCaption
			photoMsg.ParseMode = tgbotapi.ModeMarkdown
			photoMsg.ReplyMarkup = keyboards.AdminReceiptApprovalInline(receiptID, amount)
			_, _ = h.bot.Send(photoMsg)
		}

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
