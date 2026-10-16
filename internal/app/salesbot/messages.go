package salesbot

import (
	"regexp"
	"strconv"
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

// botVariableCatalog lists every dynamic placeholder that can be used inside
// message and button texts using the {{key}} syntax.
var botVariableCatalog = []map[string]string{
	{"key": "name", "label": "نام کاربر"},
	{"key": "full_name", "label": "نام کامل کاربر"},
	{"key": "username", "label": "یوزرنیم تلگرام"},
	{"key": "telegram_id", "label": "آیدی عددی کاربر"},
	{"key": "brand", "label": "نام برند"},
	{"key": "panel_name", "label": "نام / یوزرنیم پنل"},
	{"key": "panel_url", "label": "لینک پنل"},
	{"key": "panel_expire", "label": "تاریخ انقضای پنل"},
	{"key": "price_per_gb", "label": "قیمت هر گیگابایت"},
	{"key": "balance", "label": "موجودی کیف پول"},
	{"key": "min_balance", "label": "حداقل موجودی لازم"},
	{"key": "support", "label": "آیدی پشتیبانی"},
	{"key": "channel", "label": "آیدی کانال"},
	{"key": "max_panels", "label": "حداکثر تعداد پنل"},
	{"key": "active_panels", "label": "تعداد پنل فعال"},
	{"key": "test_limit", "label": "سقف پنل تست"},
	{"key": "amount", "label": "مبلغ"},
}

var botMessageRegistry = []BotMessageDef{
	// --- welcome ---
	{
		Key: "welcome", Section: "welcome", SettingKey: "welcome_message",
		Label:   "پیام خوش‌آمد (/start و منوی اصلی)",
		Vars:    []string{"brand", "name"},
		Default: "درود و خوش آمدید! 🪪\n\nبرای خرید نمایندگی بدون دردسر و اذیت، با تنوع لوکیشن بالا و قیمت مناسب و سرعت کامل، مجموعه‌ی {{brand}} در خدمت شما عزیزان می‌باشد.",
	},
	// --- purchase ---
	{
		Key: "terms", Section: "purchase", SettingKey: "terms_message",
		Label: "متن قوانین و شرایط (قبل از خرید)",
		Vars:  []string{"brand", "price_per_gb", "name"},
		Default: "🫀 <b>پرداخت فقط به اندازه مصرف</b>\n\n" +
			"در {{brand}} با مدل Pay As You Go فقط بابت ترافیک واقعی مصرف‌شده هزینه می‌پردازید؛ بدون خرید حجم از قبل و بدون هزینه پنهان.\n\n" +
			"💵 <b>هزینه هر گیگابایت:</b> {{price_per_gb}} تومان",
	},
	{
		Key: "buy_limit_reached", Section: "purchase",
		Label: "پیام رسیدن به سقف تعداد پنل",
		Vars:  []string{"active_panels", "max_panels"},
		Default: "🔒 <b>سقف تعداد پنل‌های شما تکمیل است</b>\n\n" +
			"شما در حال حاضر {{active_panels}} پنل فعال دارید و به حداکثر تعداد مجاز ({{max_panels}} عدد) رسیده‌اید.\n\n" +
			"در صورتی که نیاز به ساخت پنل جدید دارید، ابتدا یکی از پنل‌های قبلی خود را در بخش «🌐 پنل‌های من» حذف فرمایید یا با پشتیبانی در ارتباط باشید.",
	},
	{
		Key: "buy_low_balance", Section: "purchase",
		Label: "پیام موجودی ناکافی برای خرید",
		Vars:  []string{"min_balance", "balance"},
		Default: "⚠️ <b>موجودی کیف پول شما کافی نیست.</b>\n\n" +
			"برای راه‌اندازی و فعال‌سازی پنل نمایندگی، حداقل موجودی اولیه <code>{{min_balance}} تومان</code> مورد نیاز است.\n\n" +
			"💵 <b>موجودی فعلی شما:</b> <code>{{balance}} تومان</code>\n\n" +
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
		Vars:  []string{"max_panels"},
		Default: "🔒 <b>سقف تعداد پنل‌های شما تکمیل است</b>\n\n" +
			"شما در حال حاضر به حداکثر تعداد مجاز پنل ({{max_panels}} عدد) رسیده‌اید.\n\n" +
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
		Vars:    []string{"balance", "name"},
		Default: "💰 <b>کیف پول شما</b>\n\n💵 <b>موجودی فعلی:</b> {{balance}} تومان",
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
		Label: "پیام لغو/انقضای مهلت واریز",
		Vars:  []string{"amount", "name"},
		Default: "⏰ <b>مهلت پرداخت سفارش شما به پایان رسید!</b>\n\n" +
			"فاکتور پرداخت به مبلغ {{amount}} تومان منقضی گردید.\n" +
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
		Vars:  []string{"test_limit"},
		Default: "🔒 <b>شما سقف دریافت نمایندگی تست ({{test_limit}} بار) را پر کرده‌اید.</b>\n\n" +
			"هر کاربر مجاز است حداکثر {{test_limit}} بار پنل نمایندگی تست دریافت کند.\n" +
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
		Vars:  []string{"active_panels", "max_panels"},
		Default: "🔒 <b>سقف تعداد پنل‌های شما تکمیل است</b>\n\n" +
			"شما در حال حاضر {{active_panels}} پنل فعال دارید و به حداکثر تعداد مجاز ({{max_panels}} عدد) رسیده‌اید.\n\n" +
			"جهت دریافت پنل جدید، ابتدا یکی از پنل‌های قبلی خود را در بخش «🌐 پنل‌های من» حذف فرمایید یا با پشتیبانی در ارتباط باشید.",
	},
	{
		Key: "test_limit_panels_short", Section: "test",
		Label: "پیام کوتاه سقف پنل (هنگام ساخت تست)",
		Vars:  []string{"max_panels"},
		Default: "🔒 <b>سقف تعداد پنل‌های شما تکمیل است</b>\n\n" +
			"شما در حال حاضر به حداکثر تعداد مجاز پنل ({{max_panels}} عدد) رسیده‌اید.",
	},
	// --- support ---
	{
		Key: "support", Section: "support",
		Label: "پیام پشتیبانی",
		Vars:  []string{"support"},
		Default: "📮 <b>پشتیبانی و ارتباط با ما:</b>\n\n" +
			"در صورت بروز هرگونه سوال یا مشکل با آیدی زیر در ارتباط باشید:\n" +
			"👉 <b>{{support}}</b>\n\n",
	},
	{
		Key: "support_channel", Section: "support",
		Label:   "بخش کانال اطلاع‌رسانی (به پیام پشتیبانی اضافه می‌شود)",
		Vars:    []string{"channel"},
		Default: "📢 <b>کانال اطلاع‌رسانی:</b>\n👉 <b>{{channel}}</b>\n",
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
// rendering any {{variable}} placeholders from vars.
func getBotMessage(key string, vars map[string]string) string {
	def, ok := findBotMessage(key)
	if !ok {
		return ""
	}
	tpl := GetSetting(botMessageSettingKey(def), "")
	if strings.TrimSpace(tpl) == "" {
		tpl = def.Default
	}
	return RenderTemplate(tpl, vars)
}

var botVarRegex = regexp.MustCompile(`\{\{\s*([a-zA-Z0-9_]+)\s*\}\}`)

// RenderTemplate substitutes {{key}} placeholders using the provided map.
// Unknown placeholders are left untouched so admins can spot mistakes.
func RenderTemplate(tpl string, vars map[string]string) string {
	if !strings.Contains(tpl, "{{") {
		return tpl
	}
	return botVarRegex.ReplaceAllStringFunc(tpl, func(match string) string {
		sub := botVarRegex.FindStringSubmatch(match)
		if len(sub) < 2 {
			return match
		}
		if v, ok := vars[sub[1]]; ok {
			return v
		}
		return match
	})
}

// baseBotVars builds the common variable set available to every message.
func baseBotVars(u *User) map[string]string {
	vars := map[string]string{
		"brand":   GetSetting("brand_name", "zonixvpn"),
		"support": GetSetting("support_username", "@AdminSupport"),
		"channel": GetSetting("channel_username", ""),
	}
	if u != nil {
		name := strings.TrimSpace(u.FirstName)
		if name == "" {
			name = strings.TrimSpace(u.Username)
		}
		if name == "" {
			name = "کاربر"
		}
		vars["name"] = name
		vars["full_name"] = name
		vars["username"] = u.Username
		vars["telegram_id"] = strconv.FormatInt(u.TelegramID, 10)
		vars["balance"] = formatCurrency(u.WalletBalance)
	}
	return vars
}

// mergeVars returns a copy of base with the extra keys applied on top.
func mergeVars(base map[string]string, extra map[string]string) map[string]string {
	if base == nil {
		base = map[string]string{}
	}
	out := make(map[string]string, len(base)+len(extra))
	for k, v := range base {
		out[k] = v
	}
	for k, v := range extra {
		out[k] = v
	}
	return out
}

// ListBotMessages returns every registered message with its default and the
// currently configured override (empty when the default is in use).
func ListBotMessages() []map[string]any {
	list := make([]map[string]any, 0, len(botMessageRegistry))
	for _, def := range botMessageRegistry {
		sectionTitle := botMessageSectionTitles[def.Section]
		current := GetSetting(botMessageSettingKey(def), "")
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

// ListBotVariables returns the catalog of placeholders usable in templates.
func ListBotVariables() []map[string]string {
	return botVariableCatalog
}
