package keyboards

import (
	"fmt"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

func MainMenuKeyboard(hasService bool, isAdmin bool) tgbotapi.ReplyKeyboardMarkup {
	var rows [][]tgbotapi.KeyboardButton

	if !hasService {
		rows = append(rows, tgbotapi.NewKeyboardButtonRow(
			tgbotapi.NewKeyboardButton("🚀 دریافت و فعال‌سازی سرویس"),
			tgbotapi.NewKeyboardButton("💳 کیف پول و شارژ حساب"),
		))
	} else {
		rows = append(rows, tgbotapi.NewKeyboardButtonRow(
			tgbotapi.NewKeyboardButton("📊 استعلام مصرف و وضعیت"),
			tgbotapi.NewKeyboardButton("🔗 لینک اتصال هوشمند"),
		))
		rows = append(rows, tgbotapi.NewKeyboardButtonRow(
			tgbotapi.NewKeyboardButton("💳 کیف پول و شارژ حساب"),
			tgbotapi.NewKeyboardButton("🎁 تست رایگان"),
		))
	}

	rows = append(rows, tgbotapi.NewKeyboardButtonRow(
		tgbotapi.NewKeyboardButton("📖 راهنمای اتصال و دانلود"),
		tgbotapi.NewKeyboardButton("☎️ پشتیبانی"),
	))

	if isAdmin {
		rows = append(rows, tgbotapi.NewKeyboardButtonRow(
			tgbotapi.NewKeyboardButton("👑 پنل مدیریت ربات"),
		))
	}

	keyboard := tgbotapi.NewReplyKeyboard(rows...)
	keyboard.ResizeKeyboard = true
	return keyboard
}

func CancelKeyboard() tgbotapi.ReplyKeyboardMarkup {
	keyboard := tgbotapi.NewReplyKeyboard(
		tgbotapi.NewKeyboardButtonRow(
			tgbotapi.NewKeyboardButton("❌ انصراف و بازگشت"),
		),
	)
	keyboard.ResizeKeyboard = true
	return keyboard
}

func PaymentOptionsInline() tgbotapi.InlineKeyboardMarkup {
	return tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("💳 کارت به کارت دستی", "pay_card"),
			tgbotapi.NewInlineKeyboardButtonData("💎 ارز دیجیتال (تتر/TON)", "pay_crypto"),
		),
	)
}

func AdminReceiptApprovalInline(receiptID int64, amount float64) tgbotapi.InlineKeyboardMarkup {
	approveData := fmt.Sprintf("receipt_approve:%d:%.0f", receiptID, amount)
	rejectData := fmt.Sprintf("receipt_reject:%d", receiptID)

	return tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("✅ تایید و شارژ", approveData),
			tgbotapi.NewInlineKeyboardButtonData("❌ رد فیش", rejectData),
		),
	)
}

func AdminMenuInline() tgbotapi.InlineKeyboardMarkup {
	return tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("💳 گزارش مالی و تراکنش‌ها", "adm_transactions"),
			tgbotapi.NewInlineKeyboardButtonData("📶 آمار اینباندها و سرور", "adm_inbounds"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("📩 فیش‌های در انتظار بررسی", "adm_pending_receipts"),
			tgbotapi.NewInlineKeyboardButtonData("💰 تنظیم قیمت هر گیگابایت", "adm_set_price"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("💳 تنظیم شماره کارت", "adm_set_card"),
			tgbotapi.NewInlineKeyboardButtonData("💎 تنظیم آدرس ولت تتر", "adm_set_crypto"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("🎁 تنظیم تست رایگان", "adm_set_trial"),
			tgbotapi.NewInlineKeyboardButtonData("📢 ارسال پیام همگانی", "adm_broadcast"),
		),
		tgbotapi.NewInlineKeyboardRow(
			tgbotapi.NewInlineKeyboardButtonData("📊 آمار و خلاصه کلی", "adm_stats"),
			tgbotapi.NewInlineKeyboardButtonData("👥 لیست کاربران", "adm_users"),
		),
	)
}
