package salesbot

import (
	"fmt"
	"strings"
)

// BotMessageDef describes an editable bot message template.
type BotMessageDef struct {
	Key          string   `json:"key"`
	Section      string   `json:"section"`
	SectionTitle string   `json:"section_title"`
	Label        string   `json:"label"`
	Default      string   `json:"default"`
	Vars         []string `json:"vars,omitempty"`
	// SettingKey is the settings-table key used to persist the override.
	// When empty, "msg_<Key>" is used.
	SettingKey string `json:"-"`
}

var botMessageSectionTitles = map[string]string{
	"welcome":       "خوش‌آمد و منوی اصلی",
	"purchase":      "خرید پنل و شرایط",
	"panels":        "پنل‌های من",
	"wallet":        "کیف پول و واریز",
	"test":          "پنل تست",
	"support":       "پشتیبانی و اطلاع‌رسانی",
	"notifications": "اطلاع‌رسانی‌ها",
}

var botMessageRegistry = []BotMessageDef{
	// --- welcome ---
	{
		Key: "welcome", Section: "welcome", SettingKey: "welcome_message",
		Label:   "پیام خوش‌آمد (/start و منوی اصلی)",
		Vars:    []string{"نام برند"},
		Default: "درود و خوش آمدید! 🪪\n\nبرای خرید نمایندگی بدون دردسر و اذیت، با تنوع لوکیشن بالا و قیمت مناسب و سرعت کامل، مجموعه‌ی %s در خدمت شما عزیزان می‌باشد.",
	},
	// --- purchase ---
	{
		Key: "terms", Section: "purchase", SettingKey: "terms_message",
		Label: "متن قوانین و شرایط (قبل از خرید)",
		Vars:  []string{"نام برند", "قیمت هر گیگابایت"},
		Default: "🫀 <b>پرداخت فقط به اندازه مصرف</b>\n\n" +
			"در %s با مدل Pay As You Go فقط بابت ترافیک واقعی مصرف‌شده هزینه می‌پردازید؛ بدون خرید حجم از قبل و بدون هزینه پنهان.\n\n" +
			"💵 <b>هزینه هر گیگابایت:</b> %s تومان",
	},
	{
		Key: "buy_limit_reached", Section: "purchase",
		Label: "پیام رسیدن به سقف تعداد پنل",
		Vars:  []string{"تعداد پنل فعال", "حداکثر مجاز"},
		Default: "🔒 <b>سقف تعداد پنل‌های شما تکمیل است</b>\n\n" +
			"شما در حال حاضر %d پنل فعال دارید و به حداکثر تعداد مجاز (%d عدد) رسیده‌اید.\n\n" +
			"در صورتی که نیاز به ساخت پنل جدید دارید، ابتدا یکی از پنل‌های قبلی خود را در بخش «🌐 پنل‌های من» حذف فرمایید یا با پشتیبانی در ارتباط باشید.",
	},
	{
		Key: "buy_low_balance", Section: "purchase",
		Label: "پیام موجودی ناکافی برای خرید",
		Vars:  []string{"حداقل موجودی", "موجودی فعلی"},
		Default: "⚠️ <b>موجودی کیف پول شما کافی نیست.</b>\n\n" +
			"برای راه‌اندازی و فعال‌سازی پنل نمایندگی، حداقل موجودی اولیه <code>%s تومان</code> مورد نیاز است.\n\n" +
			"💵 <b>موجودی فعلی شما:</b> <code>%s تومان</code>\n\n" +
			"لطفاً ابتدا از دکمه «افزایش موجودی» نسبت به شارژ کیف پول خود اقدام فرمایید.",
	},
	{
		Key: "buy_error", Section: "purchase",
		Label:   "خطای راه‌اندازی پنل نمایندگی",
		Default: "❌ <b>خطا در راه‌اندازی پنل نمایندگی</b>\n\nمتأسفانه در اتصال به سیستم یا ساخت اکانت خطایی رخ داد. لطفاً چند لحظه بعد مجدداً تلاش فرمایید یا با پشتیبانی در ارتباط باشید.",
	},
	{
		Key: "buy_limit_reached_short", Section: "purchase",
		Label: "پیام کوتاه رسیدن به سقف پنل (هنگام ساخت)",
		Vars:  []string{"حداکثر مجاز"},
		Default: "🔒 <b>سقف تعداد پنل‌های شما تکمیل است</b>\n\n" +
			"شما در حال حاضر به حداکثر تعداد مجاز پنل (%d عدد) رسیده‌اید.\n\n" +
			"جهت ساخت پنل جدید، یکی از پنل‌های خود را در «🌐 پنل‌های من» حذف نمایید.",
	},
	// --- panels ---
	{
		Key: "panels_empty", Section: "panels",
		Label:   "پیام نداشتن پنل (با امکان تست)",
		Default: "📦 هنوز پنلی نداری.\n\nاز دکمه‌های زیر می‌تونی پنل تست یا پنل جدید بگیری.",
	},
	{
		Key: "panels_empty_no_test", Section: "panels",
		Label:   "پیام نداشتن پنل (بدون امکان تست)",
		Default: "📦 هنوز پنلی نداری.\n\nاز دکمه «دریافت پنل جدید» می‌تونی پنل جدید بگیری.",
	},
	// --- wallet ---
	{
		Key: "wallet", Section: "wallet",
		Label:   "پیام کیف پول",
		Vars:    []string{"موجودی"},
		Default: "💰 <b>کیف پول شما</b>\n\n💵 <b>موجودی فعلی:</b> %s تومان",
	},
	{
		Key: "deposit_menu", Section: "wallet",
		Label:   "پیام انتخاب روش واریز",
		Default: "💳 <b>افزایش موجودی کیف پول</b>\n\nلطفاً روش واریز مورد نظر خود را انتخاب نمایید:",
	},
	{
		Key: "deposit_method_disabled", Section: "wallet",
		Label:   "پیام غیرفعال بودن روش واریز",
		Default: "⚠️ <b>این روش واریز در حال حاضر غیرفعال است.</b>",
	},
	{
		Key: "deposit_expired", Section: "notifications",
		Label:   "پیام لغو/انقضای مهلت واریز",
		Vars:    []string{"مبلغ"},
		Default: "⏰ <b>مهلت پرداخت سفارش شما به پایان رسید!</b>\n\n" +
			"فاکتور پرداخت به مبلغ %s تومان منقضی گردید.\n" +
			"اگر واریز را انجام نداده‌اید، می‌توانید از منوی اصلی مجدداً درخواست شارژ دهید.",
	},
	// --- test ---
	{
		Key: "test_disabled", Section: "test",
		Label:   "پیام غیرفعال بودن پنل تست",
		Default: "⚠️ <b>دریافت پنل تست در حال حاضر توسط مدیریت غیرفعال شده است.</b>\n\nجهت دریافت پنل می‌توانید از گزینه خرید پنل نمایندگی استفاده فرمایید.",
	},
	{
		Key: "test_limit_reached", Section: "test",
		Label: "پیام پر شدن سقف پنل تست",
		Vars:  []string{"سقف مجاز", "سقف مجاز"},
		Default: "🔒 <b>شما سقف دریافت نمایندگی تست (%d بار) را پر کرده‌اید.</b>\n\n" +
			"هر کاربر مجاز است حداکثر %d بار پنل نمایندگی تست دریافت کند.\n" +
			"در صورتی که نیاز به پنل جدید دارید می‌توانید از منوی اصلی اقدام به خرید نمایید یا با پشتیبانی در تماس باشید.",
	},
	{
		Key: "test_error", Section: "test",
		Label:   "خطای ایجاد پنل تست",
		Default: "❌ <b>خطا در ایجاد پنل نمایندگی تست</b>\n\nمتأسفانه در اتصال به سیستم یا ساخت اکانت خطایی رخ داد. لطفاً چند لحظه بعد مجدداً تلاش فرمایید یا با پشتیبانی در ارتباط باشید.",
	},
	{
		Key: "test_limit_panels", Section: "test",
		Label: "پیام رسیدن به سقف پنل (هنگام دریافت تست)",
		Vars:  []string{"تعداد پنل فعال", "حداکثر مجاز"},
		Default: "🔒 <b>سقف تعداد پنل‌های شما تکمیل است</b>\n\n" +
			"شما در حال حاضر %d پنل فعال دارید و به حداکثر تعداد مجاز (%d عدد) رسیده‌اید.\n\n" +
			"جهت دریافت پنل جدید، ابتدا یکی از پنل‌های قبلی خود را در بخش «🌐 پنل‌های من» حذف فرمایید یا با پشتیبانی در ارتباط باشید.",
	},
	{
		Key: "test_limit_panels_short", Section: "test",
		Label: "پیام کوتاه سقف پنل (هنگام ساخت تست)",
		Vars:  []string{"حداکثر مجاز"},
		Default: "🔒 <b>سقف تعداد پنل‌های شما تکمیل است</b>\n\n" +
			"شما در حال حاضر به حداکثر تعداد مجاز پنل (%d عدد) رسیده‌اید.",
	},
	// --- support ---
	{
		Key: "support", Section: "support",
		Label: "پیام پشتیبانی",
		Vars:  []string{"آیدی پشتیبانی"},
		Default: "📮 <b>پشتیبانی و ارتباط با ما:</b>\n\n" +
			"در صورت بروز هرگونه سوال یا مشکل با آیدی زیر در ارتباط باشید:\n" +
			"👉 <b>%s</b>\n\n",
	},
	{
		Key: "support_channel", Section: "support",
		Label: "بخش کانال اطلاع‌رسانی (به پیام پشتیبانی اضافه می‌شود)",
		Vars:  []string{"آیدی کانال"},
		Default: "📢 <b>کانال اطلاع‌رسانی:</b>\n👉 <b>%s</b>\n",
	},
}

func botMessageSettingKey(def BotMessageDef) string {
	if strings.TrimSpace(def.SettingKey) != "" {
		return def.SettingKey
	}
	return "msg_" + def.Key
}

func findBotMessage(key string) (BotMessageDef, bool) {
	key = strings.TrimSpace(key)
	for _, def := range botMessageRegistry {
		if def.Key == key {
			return def, true
		}
	}
	return BotMessageDef{}, false
}

// botMessageDefault returns the built-in default text for a message key.
func botMessageDefault(key string) string {
	if def, ok := findBotMessage(key); ok {
		return def.Default
	}
	return ""
}

// getBotMessage returns the configured override for a message (or its default),
// applying fmt arguments against the resulting template.
func getBotMessage(key string, args ...any) string {
	def, ok := findBotMessage(key)
	if !ok {
		return ""
	}
	tpl := strings.TrimSpace(GetSetting(botMessageSettingKey(def), ""))
	if tpl == "" {
		tpl = def.Default
	}
	if len(args) == 0 {
		return tpl
	}
	return safeSprintf(tpl, args...)
}

func safeSprintf(tpl string, args ...any) string {
	defer func() {
		_ = recover()
	}()
	out := fmt.Sprintf(tpl, args...)
	if strings.Contains(out, "%!") {
		// Template placeholders do not match the provided args; fall back to raw.
		return tpl
	}
	return out
}

// ListBotMessages returns every registered message with its default and the
// currently configured override (empty when the default is in use).
func ListBotMessages() []map[string]any {
	list := make([]map[string]any, 0, len(botMessageRegistry))
	for _, def := range botMessageRegistry {
		sectionTitle := botMessageSectionTitles[def.Section]
		current := strings.TrimSpace(GetSetting(botMessageSettingKey(def), ""))
		list = append(list, map[string]any{
			"key":           def.Key,
			"section":       def.Section,
			"section_title": sectionTitle,
			"label":         def.Label,
			"default":       def.Default,
			"vars":          def.Vars,
			"setting_key":   botMessageSettingKey(def),
			"current":       current,
		})
	}
	return list
}
