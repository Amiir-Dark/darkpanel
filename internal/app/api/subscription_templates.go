package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	adminapp "github.com/rebeccapanel/rebecca/internal/app/admin"
	"github.com/rebeccapanel/rebecca/internal/app/rowtemplates"
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

func (s *Server) getActiveRowTemplateName(ctx context.Context) string {
	settings, err := s.settingsRepo.SubscriptionSettings(ctx)
	if err == nil && settings.SubscriptionPageTemplate != "" {
		if id, ok := rowtemplates.ExtractTemplateID(settings.SubscriptionPageTemplate); ok {
			return id
		}
	}
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

func (s *Server) getResellerActiveTemplateName(ctx context.Context, adminID int64) string {
	var raw sql.NullString
	if err := s.db.QueryRowContext(ctx, "SELECT subscription_settings FROM admins WHERE id = ? LIMIT 1", adminID).Scan(&raw); err == nil && strings.TrimSpace(raw.String) != "" {
		var parsed map[string]any
		if err := json.Unmarshal([]byte(raw.String), &parsed); err == nil {
			if tpl, ok := parsed["subscription_page_template"].(string); ok && strings.TrimSpace(tpl) != "" {
				if id, ok := rowtemplates.ExtractTemplateID(tpl); ok {
					return id
				}
			}
		}
	}
	return s.getActiveRowTemplateName(ctx)
}

func (s *Server) handleSubscriptionTemplatesRoot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	principal, _ := r.Context().Value(adminContextKey).(adminPrincipal)
	isReseller := (principal.Role == string(adminapp.RoleReseller))

	var activeTemplate string
	if isReseller {
		activeTemplate = s.getResellerActiveTemplateName(r.Context(), principal.ID)
	} else {
		activeTemplate = s.getActiveRowTemplateName(r.Context())
	}

	list := make([]SubscriptionTemplateInfo, len(availableRowTemplates))
	copy(list, availableRowTemplates)

	for i := range list {
		list[i].PreviewURL = "/api/settings/subscription-templates/" + list[i].ID + "/preview"
		list[i].IsActive = (activeTemplate == list[i].ID)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"templates":       list,
		"active_template": activeTemplate,
		"is_reseller":     isReseller,
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

	contentBytes, err := rowtemplates.ReadTemplate(templateName)
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
	isReseller := (principal.Role == string(adminapp.RoleReseller))

	shellBytes, err := rowtemplates.ReadTemplate(templateName)
	if err != nil {
		writeError(w, http.StatusNotFound, "فایل قالب یافت نشد: "+templateName)
		return
	}

	templatePathInDB := "subscription/row-template/" + templateName + "/shell.html"

	if isReseller {
		if err := s.updateResellerSubscriptionPageTemplate(r.Context(), principal.ID, templatePathInDB); err != nil {
			writeError(w, http.StatusInternalServerError, "خطا در تنظیم قالب نماینده: "+err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"success":         true,
			"message":         "قالب «" + templateName + "» با موفقیت برای کاربران شما فعال گردید.",
			"active_template": templateName,
			"is_reseller":     true,
		})
		return
	}

	// Master Admin: Write to target index.html
	targetIndex := rowtemplates.ResolveSubscriptionTargetPath()
	_ = os.MkdirAll(filepath.Dir(targetIndex), 0755)
	backupIndex := filepath.Join(filepath.Dir(targetIndex), "index.html.original")

	if _, err := os.Stat(backupIndex); os.IsNotExist(err) {
		if origBytes, err := os.ReadFile(targetIndex); err == nil && len(origBytes) > 0 {
			_ = os.WriteFile(backupIndex, origBytes, 0644)
		}
	}
	_ = os.WriteFile(targetIndex, shellBytes, 0644)

	// Also write to standard default templates/subscription/index.html if different
	standardPath := filepath.Join("templates", "subscription", "index.html")
	if standardPath != targetIndex {
		_ = os.MkdirAll(filepath.Dir(standardPath), 0755)
		_ = os.WriteFile(standardPath, shellBytes, 0644)
	}

	// Update database settings so subscription_page_template is configured to the row template
	rawSettings := map[string]json.RawMessage{
		"subscription_page_template": json.RawMessage(`"` + templatePathInDB + `"`),
	}
	if _, err := s.settingsRepo.UpdateSubscriptionSettings(r.Context(), rawSettings); err != nil {
		writeError(w, http.StatusInternalServerError, "خطا در بروزرسانی تنظیمات: "+err.Error())
		return
	}

	// Clear any admin-level subscription_page_template overrides in admins table
	// so ALL users across the entire panel will use this template
	s.clearAllAdminSubscriptionTemplateOverrides(r.Context())

	// Persist active template name
	setActiveRowTemplateName(templateName)

	writeJSON(w, http.StatusOK, map[string]any{
		"success":         true,
		"message":         "قالب «" + templateName + "» با موفقیت برای کل پنل فعال گردید.",
		"active_template": templateName,
		"is_reseller":     false,
	})
}

func (s *Server) handleSubscriptionTemplateReset(w http.ResponseWriter, r *http.Request) {
	principal, _ := r.Context().Value(adminContextKey).(adminPrincipal)
	isReseller := (principal.Role == string(adminapp.RoleReseller))

	if isReseller {
		if err := s.clearResellerSubscriptionPageTemplate(r.Context(), principal.ID); err != nil {
			writeError(w, http.StatusInternalServerError, "خطا در بازگردانی قالب: "+err.Error())
			return
		}
		serverDefault := s.getActiveRowTemplateName(r.Context())
		writeJSON(w, http.StatusOK, map[string]any{
			"success":         true,
			"message":         "قالب سابسکریپشن کاربران شما به پیش‌فرض سرور بازگردانده شد.",
			"active_template": serverDefault,
			"is_reseller":     true,
		})
		return
	}

	// Master Admin: Reset to default Rebecca
	targetIndex := rowtemplates.ResolveSubscriptionTargetPath()
	backupIndex := filepath.Join(filepath.Dir(targetIndex), "index.html.original")

	if backupBytes, err := os.ReadFile(backupIndex); err == nil && len(backupBytes) > 0 {
		_ = os.WriteFile(targetIndex, backupBytes, 0644)
	}

	rawSettings := map[string]json.RawMessage{
		"subscription_page_template": json.RawMessage(`"subscription/index.html"`),
	}
	_, _ = s.settingsRepo.UpdateSubscriptionSettings(r.Context(), rawSettings)

	s.clearAllAdminSubscriptionTemplateOverrides(r.Context())
	setActiveRowTemplateName("")

	writeJSON(w, http.StatusOK, map[string]any{
		"success":         true,
		"message":         "قالب پیش‌فرض ربکا با موفقیت فعال شد.",
		"active_template": "",
		"is_reseller":     false,
	})
}

func (s *Server) updateResellerSubscriptionPageTemplate(ctx context.Context, adminID int64, templatePath string) error {
	var raw sql.NullString
	_ = s.db.QueryRowContext(ctx, "SELECT subscription_settings FROM admins WHERE id = ? LIMIT 1", adminID).Scan(&raw)

	parsed := map[string]any{}
	if strings.TrimSpace(raw.String) != "" {
		_ = json.Unmarshal([]byte(raw.String), &parsed)
	}
	parsed["subscription_page_template"] = templatePath
	newJSON, err := json.Marshal(parsed)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, "UPDATE admins SET subscription_settings = ? WHERE id = ?", string(newJSON), adminID)
	return err
}

func (s *Server) clearResellerSubscriptionPageTemplate(ctx context.Context, adminID int64) error {
	var raw sql.NullString
	_ = s.db.QueryRowContext(ctx, "SELECT subscription_settings FROM admins WHERE id = ? LIMIT 1", adminID).Scan(&raw)

	parsed := map[string]any{}
	if strings.TrimSpace(raw.String) != "" {
		_ = json.Unmarshal([]byte(raw.String), &parsed)
	}
	delete(parsed, "subscription_page_template")
	newJSON, err := json.Marshal(parsed)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, "UPDATE admins SET subscription_settings = ? WHERE id = ?", string(newJSON), adminID)
	return err
}

func (s *Server) clearAllAdminSubscriptionTemplateOverrides(ctx context.Context) {
	rows, err := s.db.QueryContext(ctx, "SELECT id, subscription_settings FROM admins WHERE subscription_settings IS NOT NULL AND subscription_settings != ''")
	if err != nil {
		return
	}
	defer rows.Close()

	type adminRow struct {
		id       int64
		settings string
	}
	var toUpdate []adminRow
	for rows.Next() {
		var r adminRow
		if err := rows.Scan(&r.id, &r.settings); err == nil {
			var parsed map[string]any
			if err := json.Unmarshal([]byte(r.settings), &parsed); err == nil {
				if _, has := parsed["subscription_page_template"]; has {
					delete(parsed, "subscription_page_template")
					newJSON, _ := json.Marshal(parsed)
					toUpdate = append(toUpdate, adminRow{id: r.id, settings: string(newJSON)})
				}
			}
		}
	}
	for _, item := range toUpdate {
		_, _ = s.db.ExecContext(ctx, "UPDATE admins SET subscription_settings = ? WHERE id = ?", item.settings, item.id)
	}
}
