package salesbot

import (
	"encoding/json"
	"fmt"
	"strings"
)

// -------------------------------------------------------------
// Data-driven inline keyboard engine
//
// Every bot menu is described by a BotKeyboardDef (ids, default texts and
// default row layout). Admins may override the text, visibility and row
// arrangement of the *static* buttons. Buttons whose content is generated per
// user (e.g. the list of panels) are marked locked and always rendered.
// -------------------------------------------------------------

type BotButtonDef struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type BotKeyboardDef struct {
	Key      string         `json:"key"`
	Section  string         `json:"section"`
	Label    string         `json:"label"`
	Buttons  []BotButtonDef `json:"buttons"`
	Rows     [][]string     `json:"rows"`
	Locked   bool           `json:"locked,omitempty"`
	SectionT string         `json:"-"`
}

var botKeyboardSectionTitles = map[string]string{
	"main":       "منوی اصلی",
	"purchase":   "خرید پنل",
	"panels":     "پنل‌های من",
	"wallet":     "کیف پول و واریز",
	"test":       "پنل تست",
	"navigation": "بازگشت و ناوبری",
}

var botKeyboardRegistry = []BotKeyboardDef{
	{
		Key: "main_menu", Section: "main", Label: "منوی اصلی ربات",
		Buttons: []BotButtonDef{
			{"buy_panel", "⭐ دریافت پنل جدید"},
			{"my_panels", "🌐 پنل‌های من"},
			{"wallet", "💳 موجودی"},
			{"test_panel", "🧪 دریافت پنل تست"},
			{"support", "📮 پشتیبانی"},
		},
		Rows: [][]string{{"buy_panel"}, {"my_panels", "wallet"}, {"test_panel"}, {"support"}},
	},
	{
		Key: "buy_intro", Section: "purchase", Label: "منوی پیش از خرید",
		Buttons: []BotButtonDef{
			{"confirm_buy_panel", "توضیحات رو مطالعه و تایید می‌کنم."},
			{"back", "🔙 بازگشت به منو"},
		},
		Rows: [][]string{{"confirm_buy_panel"}, {"back"}},
	},
	{
		Key: "empty_panels", Section: "panels", Label: "منوی نداشتن پنل",
		Buttons: []BotButtonDef{
			{"test_panel", "🧪 دریافت پنل تست"},
			{"buy_panel", "⭐ دریافت پنل جدید"},
			{"back", "🔙 بازگشت به منو"},
		},
		Rows: [][]string{{"test_panel"}, {"buy_panel"}, {"back"}},
	},
	{
		Key: "my_panels", Section: "panels", Label: "منوی پنل‌های من",
		Buttons: []BotButtonDef{
			{"open_url", "🌐 ورود به پنل مدیریت"},
			{"deposit", "➕ افزایش موجودی"},
			{"back", "🔙 بازگشت به منو"},
		},
		Rows: [][]string{{"open_url"}, {"deposit"}, {"back"}},
	},
	{
		Key: "panels_list", Section: "panels", Label: "منوی لیست پنل‌ها",
		Buttons: []BotButtonDef{
			{"create_new", "➕ ساخت پنل جدید"},
			{"back", "🔙 بازگشت به منو"},
		},
		Rows: [][]string{{"create_new"}, {"back"}},
	},
	{
		Key: "panel_detail", Section: "panels", Label: "منوی جزئیات پنل",
		Buttons: []BotButtonDef{
			{"open_url", "🌐 ورود به درگاه پنل"},
			{"chpass", "🔑 تغییر رمز عبور"},
			{"delpanel", "🗑️ حذف پنل"},
			{"create_new", "➕ ساخت پنل جدید"},
			{"list_back", "🔙 لیست پنل‌ها"},
			{"back", "🔙 بازگشت به منو"},
		},
		Rows: [][]string{{"open_url"}, {"chpass", "delpanel"}, {"create_new"}, {"list_back", "back"}},
	},
	{
		Key: "change_pass", Section: "panels", Label: "منوی تغییر رمز پنل",
		Buttons: []BotButtonDef{
			{"gen_pass", "🎲 ساخت رمز عبور تصادفی"},
			{"input_pass", "✏️ تایپ رمز دلخواه"},
			{"back_panel", "🔙 بازگشت به پنل"},
		},
		Rows: [][]string{{"gen_pass"}, {"input_pass"}, {"back_panel"}},
	},
	{
		Key: "pass_changed", Section: "panels", Label: "منوی پس از تغییر رمز",
		Buttons: []BotButtonDef{
			{"open_url", "🌐 ورود به درگاه پنل"},
			{"back_panel", "🔙 بازگشت به پنل"},
			{"my_panels", "🌐 پنل‌های من"},
		},
		Rows: [][]string{{"open_url"}, {"back_panel", "my_panels"}},
	},
	{
		Key: "confirm_delete", Section: "panels", Label: "منوی تایید حذف پنل",
		Buttons: []BotButtonDef{
			{"confirm_del", "🗑️ بله، پنل را حذف کن"},
			{"back_panel", "🔙 انصراف و بازگشت"},
		},
		Rows: [][]string{{"confirm_del"}, {"back_panel"}},
	},
	{
		Key: "wallet_menu", Section: "wallet", Label: "منوی کیف پول",
		Buttons: []BotButtonDef{
			{"deposit", "➕ افزایش موجودی"},
			{"gift_code", "🎉 کد هدیه"},
			{"back", "🔙 بازگشت به منو"},
		},
		Rows: [][]string{{"deposit"}, {"gift_code"}, {"back"}},
	},
	{
		Key: "deposit_menu", Section: "wallet", Label: "منوی انتخاب روش واریز",
		Buttons: []BotButtonDef{
			{"deposit_5min", "⚡ کارت به کارت هوشمند (شناسایی ۵ دقیقه‌ای)"},
			{"deposit_receipt", "💳 واریز کارت به کارت (ارسال فیش)"},
			{"deposit_crypto", "🪙 پرداخت با رمزارز (USDT / TON)"},
			{"back", "🔙 بازگشت به منو"},
		},
		Rows: [][]string{{"deposit_5min"}, {"deposit_receipt"}, {"deposit_crypto"}, {"back"}},
	},
	{
		Key: "deposit_only", Section: "wallet", Label: "منوی شارژ سریع کیف پول",
		Buttons: []BotButtonDef{
			{"deposit", "➕ افزایش موجودی"},
			{"back", "🔙 بازگشت به منو"},
		},
		Rows: [][]string{{"deposit"}, {"back"}},
	},
	{
		Key: "test_success", Section: "test", Label: "منوی موفقیت پنل تست",
		Buttons: []BotButtonDef{
			{"open_url", "🌐 ورود به پنل مدیریت"},
			{"my_panels", "🌐 پنل‌های من"},
			{"back", "🔙 بازگشت به منو"},
		},
		Rows: [][]string{{"open_url"}, {"my_panels", "back"}},
	},
	{
		Key: "back_menu", Section: "navigation", Label: "منوی بازگشت (تک‌دکمه‌ای)",
		Buttons: []BotButtonDef{
			{"back", "🔙 بازگشت به منو"},
		},
		Rows: [][]string{{"back"}},
	},
}

func findBotKeyboard(key string) (BotKeyboardDef, bool) {
	key = strings.TrimSpace(key)
	for _, def := range botKeyboardRegistry {
		if def.Key == key {
			return def, true
		}
	}
	return BotKeyboardDef{}, false
}

// kbCtx carries the per-call data needed to render a keyboard.
type kbCtx struct {
	User          *User
	Panel         *UserPanel
	PanelID       int64
	Panels        []UserPanel
	PanelURL      string
	CanTakeTest   bool
	CanCreateMore bool
	TotalPanels   int
	Vars          map[string]string
}

func (c *kbCtx) vars() map[string]string {
	if c.Vars != nil {
		return c.Vars
	}
	vars := baseBotVars(c.User)
	c.Vars = vars
	return vars
}

func (c *kbCtx) panelID() int64 {
	if c.Panel != nil {
		return c.Panel.ID
	}
	return c.PanelID
}

func (c *kbCtx) panelURL() string {
	if strings.TrimSpace(c.PanelURL) != "" {
		return c.PanelURL
	}
	if c.Panel != nil {
		return c.Panel.PanelURL
	}
	return ""
}

func validHTTPURL(u string) bool {
	return strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://")
}

// -------------------------------------------------------------
// Button override (persisted as JSON in settings key "kbd_<key>")
// -------------------------------------------------------------

type buttonOverride struct {
	Rows   [][]string        `json:"rows"`
	Labels map[string]string `json:"labels"`
	Hidden []string          `json:"hidden"`
}

func loadButtonOverride(key string) *buttonOverride {
	raw := strings.TrimSpace(GetSetting("kbd_"+key, ""))
	if raw == "" {
		return nil
	}
	var o buttonOverride
	if err := json.Unmarshal([]byte(raw), &o); err != nil || len(o.Rows) == 0 {
		return nil
	}
	return &o
}

type kbCell struct {
	ID     string
	Button InlineKeyboardButton
	Locked bool
}

// applyButtonOverride reorders/renames/hides static cells according to the
// stored override. Dynamic (locked) cells are handled by the caller.
func applyButtonOverride(key string, rows [][]kbCell, vars map[string]string) [][]kbCell {
	o := loadButtonOverride(key)

	if o == nil {
		for i := range rows {
			for j := range rows[i] {
				rows[i][j].Button.Text = RenderTemplate(rows[i][j].Button.Text, vars)
			}
		}
		return rows
	}

	cells := map[string]kbCell{}
	var order []string
	for _, r := range rows {
		for _, c := range r {
			cells[c.ID] = c
			order = append(order, c.ID)
		}
	}

	hidden := map[string]bool{}
	labels := map[string]string{}
	for _, h := range o.Hidden {
		hidden[h] = true
	}
	for k, v := range o.Labels {
		labels[k] = v
	}

	out := make([][]kbCell, 0, len(rows))
	used := map[string]bool{}
	for _, row := range o.Rows {
		var newRow []kbCell
		for _, id := range row {
			c, ok := cells[id]
			if !ok || hidden[id] || used[id] {
				continue
			}
			used[id] = true
			newRow = append(newRow, c)
		}
		if len(newRow) > 0 {
			out = append(out, newRow)
		}
	}
	for _, id := range order {
		if used[id] || hidden[id] {
			continue
		}
		out = append(out, []kbCell{cells[id]})
	}

	for i := range out {
		for j := range out[i] {
			if lbl, ok := labels[out[i][j].ID]; ok && strings.TrimSpace(lbl) != "" {
				out[i][j].Button.Text = lbl
			}
			out[i][j].Button.Text = RenderTemplate(out[i][j].Button.Text, vars)
		}
	}
	return out
}

// -------------------------------------------------------------
// Button construction
// -------------------------------------------------------------

func kbButtonVisible(key, id string, ctx *kbCtx) bool {
	switch id {
	case "open_url":
		return validHTTPURL(ctx.panelURL())
	case "test_panel":
		if key == "empty_panels" {
			return ctx.CanTakeTest
		}
		return true
	case "create_new":
		return ctx.CanCreateMore
	case "list_back":
		return ctx.TotalPanels > 1
	case "deposit_5min":
		return settingOn("deposit_5min_enabled", true)
	case "deposit_receipt":
		return settingOn("deposit_receipt_enabled", true)
	case "deposit_crypto":
		return settingOn("deposit_crypto_enabled", true) &&
			(strings.TrimSpace(GetSetting("tether_wallet", "")) != "" || strings.TrimSpace(GetSetting("ton_wallet", "")) != "")
	}
	return true
}

func kbButtonAction(id string, ctx *kbCtx) InlineKeyboardButton {
	switch id {
	case "buy_panel":
		return InlineKeyboardButton{CallbackData: "buy_panel"}
	case "my_panels":
		return InlineKeyboardButton{CallbackData: "my_panels"}
	case "wallet":
		return InlineKeyboardButton{CallbackData: "wallet"}
	case "test_panel":
		return InlineKeyboardButton{CallbackData: "test_panel"}
	case "support":
		return InlineKeyboardButton{CallbackData: "support"}
	case "confirm_buy_panel":
		return InlineKeyboardButton{CallbackData: "confirm_buy_panel"}
	case "deposit":
		return InlineKeyboardButton{CallbackData: "deposit"}
	case "gift_code":
		return InlineKeyboardButton{CallbackData: "gift_code"}
	case "back":
		return InlineKeyboardButton{CallbackData: "main_menu"}
	case "deposit_5min":
		return InlineKeyboardButton{CallbackData: "deposit_5min"}
	case "deposit_receipt":
		return InlineKeyboardButton{CallbackData: "deposit_receipt"}
	case "deposit_crypto":
		return InlineKeyboardButton{CallbackData: "deposit_crypto"}
	case "open_url":
		return InlineKeyboardButton{URL: ctx.panelURL()}
	case "create_new":
		return InlineKeyboardButton{CallbackData: "buy_panel"}
	case "list_back":
		return InlineKeyboardButton{CallbackData: "my_panels"}
	case "chpass":
		return InlineKeyboardButton{CallbackData: fmt.Sprintf("chpass:%d", ctx.panelID())}
	case "delpanel":
		return InlineKeyboardButton{CallbackData: fmt.Sprintf("delpanel:%d", ctx.panelID())}
	case "gen_pass":
		return InlineKeyboardButton{CallbackData: fmt.Sprintf("gen_pass:%d", ctx.panelID())}
	case "input_pass":
		return InlineKeyboardButton{CallbackData: fmt.Sprintf("input_pass:%d", ctx.panelID())}
	case "back_panel":
		return InlineKeyboardButton{CallbackData: fmt.Sprintf("view_panel:%d", ctx.panelID())}
	case "confirm_del":
		return InlineKeyboardButton{CallbackData: fmt.Sprintf("confirm_del:%d", ctx.panelID())}
	}
	return InlineKeyboardButton{CallbackData: id}
}

func kbButtonText(key string, def BotButtonDef, ctx *kbCtx) string {
	if key == "panel_detail" && def.ID == "back" && ctx.TotalPanels > 1 {
		return "🏠 منوی اصلی"
	}
	return def.Text
}

// renderBotKeyboard builds the inline keyboard for the given menu key.
func renderBotKeyboard(key string, ctx *kbCtx) InlineKeyboardMarkup {
	def, ok := findBotKeyboard(key)
	if !ok {
		return InlineKeyboardMarkup{}
	}
	if ctx == nil {
		ctx = &kbCtx{}
	}
	vars := ctx.vars()

	byID := map[string]BotButtonDef{}
	for _, b := range def.Buttons {
		byID[b.ID] = b
	}

	var rows [][]kbCell
	for _, row := range def.Rows {
		var cells []kbCell
		for _, id := range row {
			b, ok := byID[id]
			if !ok || !kbButtonVisible(key, id, ctx) {
				continue
			}
			btn := kbButtonAction(id, ctx)
			btn.Text = kbButtonText(key, b, ctx)
			cells = append(cells, kbCell{ID: id, Button: btn})
		}
		if len(cells) > 0 {
			rows = append(rows, cells)
		}
	}

	rows = applyButtonOverride(key, rows, vars)
	return cellsToMarkup(rows)
}

func cellsToMarkup(rows [][]kbCell) InlineKeyboardMarkup {
	out := make([][]InlineKeyboardButton, 0, len(rows))
	for _, row := range rows {
		line := make([]InlineKeyboardButton, 0, len(row))
		for _, c := range row {
			line = append(line, c.Button)
		}
		if len(line) > 0 {
			out = append(out, line)
		}
	}
	return InlineKeyboardMarkup{InlineKeyboard: out}
}

// renderPanelsList builds the dynamic list of a user's panels followed by the
// editable static buttons (create new / back).
func renderPanelsList(ctx *kbCtx) InlineKeyboardMarkup {
	if ctx == nil {
		ctx = &kbCtx{}
	}
	var dyn [][]kbCell
	for _, p := range ctx.Panels {
		st := "فعال ✅"
		if p.Status == "disabled" {
			st = "غیرفعال ⚠️"
		}
		dyn = append(dyn, []kbCell{{
			ID:     fmt.Sprintf("panel_%d", p.ID),
			Locked: true,
			Button: InlineKeyboardButton{
				Text:         fmt.Sprintf("🔹 %s (%s)", p.PanelUsername, st),
				CallbackData: fmt.Sprintf("view_panel:%d", p.ID),
			},
		}})
	}

	static := renderStaticRows("panels_list", ctx)
	return cellsToMarkup(append(dyn, static...))
}

// renderStaticRows returns the (override-applied) rows for a keyboard without
// the dynamic prefix.
func renderStaticRows(key string, ctx *kbCtx) [][]kbCell {
	def, ok := findBotKeyboard(key)
	if !ok {
		return nil
	}
	byID := map[string]BotButtonDef{}
	for _, b := range def.Buttons {
		byID[b.ID] = b
	}
	var rows [][]kbCell
	for _, row := range def.Rows {
		var cells []kbCell
		for _, id := range row {
			b, ok := byID[id]
			if !ok || !kbButtonVisible(key, id, ctx) {
				continue
			}
			btn := kbButtonAction(id, ctx)
			btn.Text = kbButtonText(key, b, ctx)
			cells = append(cells, kbCell{ID: id, Button: btn})
		}
		if len(cells) > 0 {
			rows = append(rows, cells)
		}
	}
	return applyButtonOverride(key, rows, ctx.vars())
}

// ListBotKeyboards returns the keyboard catalog with the current overrides so
// the dashboard can render the button layout editor.
func ListBotKeyboards() []map[string]any {
	list := make([]map[string]any, 0, len(botKeyboardRegistry))
	for _, def := range botKeyboardRegistry {
		buttons := make([]map[string]any, 0, len(def.Buttons))
		for _, b := range def.Buttons {
			buttons = append(buttons, map[string]any{
				"id":   b.ID,
				"text": b.Text,
			})
		}
		raw := GetSetting("kbd_"+def.Key, "")
		list = append(list, map[string]any{
			"key":           def.Key,
			"section":       def.Section,
			"section_title": botKeyboardSectionTitles[def.Section],
			"label":         def.Label,
			"buttons":       buttons,
			"rows":          def.Rows,
			"setting_key":   "kbd_" + def.Key,
			"current":       raw,
		})
	}
	return list
}
