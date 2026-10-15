package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	adminapp "github.com/rebeccapanel/rebecca/internal/app/admin"
	"github.com/rebeccapanel/rebecca/internal/app/user"
)

type SubscriptionTemplateInfo struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	NameEn      string   `json:"name_en"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	AccentColor string   `json:"accent_color"`
	IsActive    bool     `json:"is_active"`
	PreviewURL  string   `json:"preview_url"`
}

var availableRowTemplates = []SubscriptionTemplateInfo{
	{
		ID:          "row",
		Name:        "Row (پیش‌فرض مدرن)",
		NameEn:      "Row",
		Description: "طراحی شیک، تمیز و استاندارد با دارک‌مود/لایت‌مود، بارکد QR و دکمه‌های کلاینت‌های محبوب",
		Category:    "مدرن و استاندارد",
		AccentColor: "#8B5CF6",
	},
	{
		ID:          "editorial",
		Name:        "Editorial (ژورنالی لوکس)",
		NameEn:      "Editorial",
		Description: "طراحی تایپوگرافی شبیه به مجلات بین‌المللی با فونت‌های شکیل و حاشیه‌های مدرن",
		Category:    "تایپوگرافی",
		AccentColor: "#3B82F6",
	},
	{
		ID:          "canvas",
		Name:        "Canvas (بوم مینیمال)",
		NameEn:      "Canvas",
		Description: "سبک فوق مینیمال با فریم‌های حاشیه‌دار خلوت و خطوط ظریف مناسب سخت‌پسندان",
		Category:    "مینیمال",
		AccentColor: "#64748B",
	},
	{
		ID:          "prism",
		Name:        "Prism (منشور گلس)",
		NameEn:      "Prism",
		Description: "افکت گلس‌مورفیسم شفاف با گرادیان‌های رنگی هولوگرافیک و بازتاب نور منشور",
		Category:    "گلس‌مورفیسم",
		AccentColor: "#EC4899",
	},
	{
		ID:          "terminal",
		Name:        "Terminal (ترمینال هکری)",
		NameEn:      "Terminal",
		Description: "محیط ترمینال سیاه با فونت سبز هکری و استایل کامندلاینی سایبرپانک",
		Category:    "سایبرپانک",
		AccentColor: "#10B981",
	},
	{
		ID:          "pulse",
		Name:        "Pulse (پالس نئون)",
		NameEn:      "Pulse",
		Description: "انیمیشن‌ها و نوارهای نئونی بنفش و فیروزه‌ای تپنده با جلوه پر انرژی",
		Category:    "نئون / پویا",
		AccentColor: "#A855F7",
	},
	{
		ID:          "brutal",
		Name:        "Brutal (نئوبروتالیسم)",
		NameEn:      "Brutal",
		Description: "سبک پرطرفدار نئوبروتال با بردرهای مشکی پررنگ، کنتراست فوق‌العاده و سایه‌های زاویه‌دار",
		Category:    "نئوبروتالیسم",
		AccentColor: "#F59E0B",
	},
	{
		ID:          "arcade",
		Name:        "Arcade (بازی‌های ۸ بیتی)",
		NameEn:      "Arcade",
		Description: "حس نوستالژی بازی‌های رترو دهه ۸۰ با فونت‌های پیکسلی و المان‌های بازی",
		Category:    "گیمینگ / پیکسلی",
		AccentColor: "#EF4444",
	},
	{
		ID:          "sketch",
		Name:        "Sketch (طراحی دستی)",
		NameEn:      "Sketch",
		Description: "استایل خلاقانه دست‌کشیده و مدادی با بافت کاغذ طبیعی و حس هنری",
		Category:    "هنری / دست‌ساز",
		AccentColor: "#78716C",
	},
	{
		ID:          "signature",
		Name:        "Signature (لوکس مشکی-طلایی)",
		NameEn:      "Signature",
		Description: "تم پرمیوم مشکی تیره با حاشیه‌ها و هایلایت‌های طلایی لوکس و شیک",
		Category:    "لوکس / VIP",
		AccentColor: "#EAB308",
	},
	{
		ID:          "saffron",
		Name:        "Saffron (زعفران / گرم)",
		NameEn:      "Saffron",
		Description: "الهام‌گرفته از طلوع آفتاب و رنگ‌های کهربایی و گرم زعفرانی",
		Category:    "گرم / شرقی",
		AccentColor: "#F97316",
	},
	{
		ID:          "pulsenova",
		Name:        "Pulse Nova (سوپرنوا پالس)",
		NameEn:      "Pulse Nova",
		Description: "نسخه کهکشانی و ارتقایافته پالس با جزئیات بیشتر و جلوه‌های مدرن‌تر",
		Category:    "نئون / آینده‌نگر",
		AccentColor: "#06B6D4",
	},
	{
		ID:          "prismnova",
		Name:        "Prism Nova (کریستال نئوپریسم)",
		NameEn:      "Prism Nova",
		Description: "ترکیب منشور شیشه‌ای با عمق سه‌بعدی و گرادیان‌های شناور چشم‌نواز",
		Category:    "گلس‌مورفیسم",
		AccentColor: "#D946EF",
	},
	{
		ID:          "terminalnova",
		Name:        "Terminal Nova (ماتریکس مدرن)",
		NameEn:      "Terminal Nova",
		Description: "کنسول خط فرمان مدرن به همراه ویجت‌های پایش سیستم و استایل ماتریسی",
		Category:    "سایبرپانک",
		AccentColor: "#22C55E",
	},
	{
		ID:          "arcadenova",
		Name:        "Arcade Nova (سینت‌ویو)",
		NameEn:      "Arcade Nova",
		Description: "سبک سینت‌ویو دهه هشتادی با رنگ‌بندی بنفش نئونی و غروب سایبری",
		Category:    "سینت‌ویو / نئون",
		AccentColor: "#8B5CF6",
	},
	{
		ID:          "meter",
		Name:        "Meter (داشبورد تله‌متری)",
		NameEn:      "Meter",
		Description: "صفحه آمپر و گیج‌های سنجش ترافیک با استایل داشبورد خودروهای اسپرت",
		Category:    "داشبورد / گیج",
		AccentColor: "#0EA5E9",
	},
	{
		ID:          "notebook",
		Name:        "Notebook (دفترچه یادداشت)",
		NameEn:      "Notebook",
		Description: "طراحی کلاسیک شبیه دفترچه یادداشت روزانه با خطوط ملایم و خوانایی بالا",
		Category:    "کلاسیک / کاغذی",
		AccentColor: "#6B7280",
	},
}

func getActiveRowTemplateName() string {
	stateFile := filepath.Join("templates", "subscription", "row-template", ".active")
	if data, err := os.ReadFile(stateFile); err == nil {
		t := strings.TrimSpace(string(data))
		if t != "" {
			return t
		}
	}
	return ""
}

func setActiveRowTemplateName(name string) {
	stateFile := filepath.Join("templates", "subscription", "row-template", ".active")
	_ = os.WriteFile(stateFile, []byte(strings.TrimSpace(name)), 0644)
}

func (s *Server) handleSubscriptionTemplatesRoot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	activeTemplate := getActiveRowTemplateName()
	list := make([]SubscriptionTemplateInfo, len(availableRowTemplates))
	copy(list, availableRowTemplates)

	for i := range list {
		list[i].PreviewURL = "/api/settings/subscription-templates/" + list[i].ID + "/preview"
		list[i].IsActive = (activeTemplate == list[i].ID)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"templates":       list,
		"active_template": activeTemplate,
	})
}

func (s *Server) handleSubscriptionTemplatesPath(w http.ResponseWriter, r *http.Request) {
	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/settings/subscription-templates/"), "/")

	if path == "reset" {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		s.requireAdmin(func(w http.ResponseWriter, r *http.Request) {
			s.handleSubscriptionTemplateReset(w, r)
		})(w, r)
		return
	}

	if strings.HasSuffix(path, "/preview") {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		templateName := strings.TrimSuffix(path, "/preview")
		s.handleSubscriptionTemplatePreview(w, r, templateName)
		return
	}

	if strings.HasSuffix(path, "/activate") {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		templateName := strings.TrimSuffix(path, "/activate")
		s.requireAdmin(func(w http.ResponseWriter, r *http.Request) {
			s.handleSubscriptionTemplateActivate(w, r, templateName)
		})(w, r)
		return
	}

	writeError(w, http.StatusNotFound, "not found")
}

func (s *Server) handleSubscriptionTemplatePreview(w http.ResponseWriter, r *http.Request, templateName string) {
	// Authenticate admin (via session cookie, bearer header, or ?token=)
	token := r.URL.Query().Get("token")
	if token != "" && r.Header.Get("Authorization") == "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	if _, err := s.authenticate(r.Context(), r); err != nil {
		writeAuthError(w, err)
		return
	}

	shellPath := filepath.Join("templates", "subscription", "row-template", templateName, "shell.html")
	contentBytes, err := os.ReadFile(shellPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "قالب مورد نظر یافت نشد: "+templateName)
		return
	}

	renderedHTML, err := user.RenderSubscriptionPreview(string(contentBytes))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "خطا در رندر پیش‌نمایش قالب: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(renderedHTML))
}

func (s *Server) handleSubscriptionTemplateActivate(w http.ResponseWriter, r *http.Request, templateName string) {
	principal, _ := r.Context().Value(adminContextKey).(adminPrincipal)
	if principal.Role == string(adminapp.RoleReseller) {
		writeError(w, http.StatusForbidden, "نمایندگان مجاز به تغییر قالب سابسکریپشن سرور نیستند")
		return
	}

	shellPath := filepath.Join("templates", "subscription", "row-template", templateName, "shell.html")
	shellBytes, err := os.ReadFile(shellPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "فایل قالب یافت نشد: "+templateName)
		return
	}

	targetIndex := filepath.Join("templates", "subscription", "index.html")
	backupIndex := filepath.Join("templates", "subscription", "index.html.original")

	// Backup original index.html if backup does not exist yet
	if _, err := os.Stat(backupIndex); os.IsNotExist(err) {
		if origBytes, err := os.ReadFile(targetIndex); err == nil && len(origBytes) > 0 {
			_ = os.WriteFile(backupIndex, origBytes, 0644)
		}
	}

	// Copy selected template to index.html
	if err := os.WriteFile(targetIndex, shellBytes, 0644); err != nil {
		writeError(w, http.StatusInternalServerError, "خطا در ذخیره قالب: "+err.Error())
		return
	}

	// Update database settings so subscription_page_template is configured
	templatePathInDB := "subscription/row-template/" + templateName + "/shell.html"
	rawSettings := map[string]json.RawMessage{
		"subscription_page_template": json.RawMessage(`"` + templatePathInDB + `"`),
	}
	_, _ = s.settingsRepo.UpdateSubscriptionSettings(r.Context(), rawSettings)

	// Persist active template name
	setActiveRowTemplateName(templateName)

	writeJSON(w, http.StatusOK, map[string]any{
		"success":         true,
		"message":         "قالب «" + templateName + "» با موفقیت برای کل پنل فعال گردید.",
		"active_template": templateName,
	})
}

func (s *Server) handleSubscriptionTemplateReset(w http.ResponseWriter, r *http.Request) {
	principal, _ := r.Context().Value(adminContextKey).(adminPrincipal)
	if principal.Role == string(adminapp.RoleReseller) {
		writeError(w, http.StatusForbidden, "نمایندگان مجاز به تغییر قالب سابسکریپشن سرور نیستند")
		return
	}

	targetIndex := filepath.Join("templates", "subscription", "index.html")
	backupIndex := filepath.Join("templates", "subscription", "index.html.original")

	if backupBytes, err := os.ReadFile(backupIndex); err == nil && len(backupBytes) > 0 {
		_ = os.WriteFile(targetIndex, backupBytes, 0644)
	}

	rawSettings := map[string]json.RawMessage{
		"subscription_page_template": json.RawMessage(`"subscription/index.html"`),
	}
	_, _ = s.settingsRepo.UpdateSubscriptionSettings(r.Context(), rawSettings)

	setActiveRowTemplateName("")

	writeJSON(w, http.StatusOK, map[string]any{
		"success":         true,
		"message":         "قالب پیش‌فرض ربکا با موفقیت فعال شد.",
		"active_template": "",
	})
}
