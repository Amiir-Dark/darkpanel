package user

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	subscriptionTypeUsernameKey = "username-key"
	subscriptionTypeKey         = "key"
	subscriptionTypeToken       = "token"
	subscriptionTypeKeyUsername = "key-username"
)

func BuildSubscriptionLinks(req SubscriptionLinkRequest, base SubscriptionSettings, admin AdminLinkSettings, secret string) (SubscriptionLinks, error) {
	username := strings.TrimSpace(req.Username)
	if username == "" {
		return SubscriptionLinks{}, fmt.Errorf("username is required")
	}
	if strings.TrimSpace(secret) == "" {
		return SubscriptionLinks{}, fmt.Errorf("subscription secret key is required")
	}

	settings := effectiveSubscriptionSettings(base, admin)
	salt := req.Salt
	if salt == "" {
		generated, err := randomSalt()
		if err != nil {
			return SubscriptionLinks{}, err
		}
		salt = generated
	}
	prefixes := buildSubscriptionBases(settings, salt, req.RequestOrigin)
	urlPrefix := "/sub"
	if len(prefixes) > 0 {
		urlPrefix = prefixes[0]
	}

	links := NewOrderedStringMap(8)
	subadress := strings.TrimSpace(req.Subadress)
	credentialKey := strings.TrimSpace(req.CredentialKey)
	if subadress != "" {
		links.Set("subadress", urlPrefix+"/"+subadress)
	}
	if credentialKey != "" {
		links.Set(subscriptionTypeUsernameKey, urlPrefix+"/"+username+"/"+credentialKey)
		links.Set(subscriptionTypeKey, urlPrefix+"/"+credentialKey)
		links.Set(subscriptionTypeKeyUsername, urlPrefix+"/"+credentialKey+"#"+username)
	}

	token := createSubscriptionToken(username, secret, time.Now())
	links.Set(subscriptionTypeToken, urlPrefix+"/"+token)

	for _, extraPrefix := range prefixes[1:] {
		label := prefixLabel(extraPrefix)
		if subadress != "" {
			links.Set("subadress@"+label, extraPrefix+"/"+subadress)
		}
		if credentialKey != "" {
			links.Set(subscriptionTypeUsernameKey+"@"+label, extraPrefix+"/"+username+"/"+credentialKey)
			links.Set(subscriptionTypeKey+"@"+label, extraPrefix+"/"+credentialKey)
			links.Set(subscriptionTypeKeyUsername+"@"+label, extraPrefix+"/"+credentialKey+"#"+username)
		}
		links.Set(subscriptionTypeToken+"@"+label, extraPrefix+"/"+token)
	}

	if settings.AppendUsernameToLinks {
		for _, key := range links.keys {
			val := links.values[key]
			if !strings.Contains(val, "#") {
				links.values[key] = val + "#" + username
			}
		}
	}

	primary := selectPrimaryLink(links, credentialKey != "", subadress != "", preferredType(req.Preferred, settings.DefaultSubscriptionType))
	if settings.AppendUsernameToLinks && !strings.Contains(primary, "#") {
		primary = primary + "#" + username
	}
	result := NewOrderedStringMap(len(links.keys) + 1)
	result.Set("primary", primary)
	for _, key := range links.keys {
		result.Set(key, links.values[key])
	}
	return SubscriptionLinks{Primary: primary, Links: result}, nil
}

func effectiveSubscriptionSettings(base SubscriptionSettings, admin AdminLinkSettings) SubscriptionSettings {
	effective := SubscriptionSettings{
		DefaultSubscriptionType:        preferredType("", base.DefaultSubscriptionType),
		SubscriptionURLPrefix:          normalizePrefix(base.SubscriptionURLPrefix),
		SubscriptionProfileTitle:       firstNonEmptyString(base.SubscriptionProfileTitle, "Subscription"),
		SubscriptionSupportURL:         firstNonEmptyString(base.SubscriptionSupportURL, "https://t.me/"),
		SubscriptionUpdateInterval:     firstNonEmptyString(base.SubscriptionUpdateInterval, "12"),
		SubscriptionPath:               normalizePath(base.SubscriptionPath),
		SubscriptionPorts:              normalizePorts(base.SubscriptionPorts),
		SubscriptionAliases:            append([]string{}, base.SubscriptionAliases...),
		ClientRoutingRules:             append([]ClientRoutingRule{}, base.ClientRoutingRules...),
		BlockedClientApps:              append([]string{}, base.BlockedClientApps...),
		BlockedClientMessage:           base.BlockedClientMessage,
		ClientAppFormats:               copyStringMap(base.ClientAppFormats),
		SubscriptionPlaceholderEnabled: base.SubscriptionPlaceholderEnabled,
		SubscriptionPlaceholderRemark:  firstNonEmptyString(base.SubscriptionPlaceholderRemark, "disabled"),
		SubscriptionAnnouncement:       base.SubscriptionAnnouncement,
		HappSubInfoColor:               base.HappSubInfoColor,
		HappSubInfoButtonText:          base.HappSubInfoButtonText,
		HappSubInfoButtonLink:          base.HappSubInfoButtonLink,
		HappSubExpire:                  base.HappSubExpire,
		HappSubExpireButtonLink:        base.HappSubExpireButtonLink,
		HappAnnouncementTargetType:     firstNonEmptyString(base.HappAnnouncementTargetType, "all"),
		HappAnnouncementTargetUsers:    base.HappAnnouncementTargetUsers,
		AnnounceURL:                    base.AnnounceURL,
		MaxLinksPerUser:                base.MaxLinksPerUser,
		RandomizeLinks:                 base.RandomizeLinks,
		ShowConfigLinks:                base.ShowConfigLinks,
		AppendUsernameToLinks:          base.AppendUsernameToLinks,
		SubscriptionTemplateEnabled:    base.SubscriptionTemplateEnabled,
		InboundRemarks:                 base.InboundRemarks,
		TelegramBackupEnabled:          base.TelegramBackupEnabled,
		TelegramBotToken:               base.TelegramBotToken,
		TelegramChatID:                 base.TelegramChatID,
		TelegramBackupInterval:         base.TelegramBackupInterval,
		RawPanelSettings:               base.RawPanelSettings,
		RawSubscriptionSettings:        base.RawSubscriptionSettings,
	}

	var overrides map[string]any
	if len(admin.SubscriptionSettings) > 0 {
		_ = json.Unmarshal(admin.SubscriptionSettings, &overrides)
	}
	for key, value := range overrides {
		if isEmptyOverride(value) {
			continue
		}
		switch key {
		case "subscription_url_prefix":
			if text, ok := coerceString(value); ok {
				effective.SubscriptionURLPrefix = normalizePrefix(text)
			}
		case "subscription_profile_title":
			if text, ok := coerceString(value); ok && text != "" {
				effective.SubscriptionProfileTitle = text
			}
		case "subscription_support_url":
			if text, ok := coerceString(value); ok && text != "" {
				effective.SubscriptionSupportURL = ensureScheme(text)
			}
		case "subscription_update_interval":
			if text, ok := coerceString(value); ok && text != "" {
				effective.SubscriptionUpdateInterval = text
			}
		case "subscription_path":
			if text, ok := coerceString(value); ok {
				effective.SubscriptionPath = normalizePath(text)
			}
		case "subscription_ports":
			effective.SubscriptionPorts = normalizePorts(value)
		case "subscription_aliases":
			effective.SubscriptionAliases = normalizeAliases(value)
		case "client_routing_rules":
			if text, ok := coerceString(value); ok {
				var rules []ClientRoutingRule
				if err := json.Unmarshal([]byte(text), &rules); err == nil {
					effective.ClientRoutingRules = rules
				}
			}
		case "subscription_placeholder_enabled":
			effective.SubscriptionPlaceholderEnabled = truthy(value)
		case "subscription_placeholder_remark":
			if text, ok := coerceString(value); ok && strings.TrimSpace(text) != "" {
				effective.SubscriptionPlaceholderRemark = strings.TrimSpace(text)
			}
		case "subscription_announcement":
			if text, ok := coerceString(value); ok {
				effective.SubscriptionAnnouncement = strings.TrimSpace(text)
			}
		case "happ_sub_info_color":
			if text, ok := coerceString(value); ok {
				effective.HappSubInfoColor = strings.TrimSpace(text)
			}
		case "happ_sub_info_button_text":
			if text, ok := coerceString(value); ok {
				effective.HappSubInfoButtonText = strings.TrimSpace(text)
			}
		case "happ_sub_info_button_link":
			if text, ok := coerceString(value); ok {
				effective.HappSubInfoButtonLink = strings.TrimSpace(text)
			}
		case "happ_sub_expire":
			effective.HappSubExpire = truthy(value)
		case "happ_sub_expire_button_link":
			if text, ok := coerceString(value); ok {
				effective.HappSubExpireButtonLink = strings.TrimSpace(text)
			}
		case "happ_announcement_target_type":
			if text, ok := coerceString(value); ok {
				effective.HappAnnouncementTargetType = strings.TrimSpace(text)
			}
		case "happ_announcement_target_users":
			if text, ok := coerceString(value); ok {
				effective.HappAnnouncementTargetUsers = strings.TrimSpace(text)
			}
		case "blocked_client_apps":
			effective.BlockedClientApps = normalizeBlockedClientApps(value)
		case "blocked_client_message":
			if text, ok := coerceString(value); ok {
				effective.BlockedClientMessage = strings.TrimSpace(text)
			}
		case "announce_url":
			if text, ok := coerceString(value); ok && strings.TrimSpace(text) != "" {
				effective.AnnounceURL = ensureScheme(text)
			}
		case "max_links_per_user":
			switch v := value.(type) {
			case float64:
				effective.MaxLinksPerUser = int(v)
			case int:
				effective.MaxLinksPerUser = v
			case string:
				effective.MaxLinksPerUser, _ = strconv.Atoi(strings.TrimSpace(v))
			}
		case "randomize_links":
			effective.RandomizeLinks = truthy(value)
		case "show_config_links":
			b := truthy(value)
			effective.ShowConfigLinks = &b
		case "append_username_to_links":
			effective.AppendUsernameToLinks = truthy(value)
		case "subscription_template_enabled":
			b := truthy(value)
			effective.SubscriptionTemplateEnabled = &b
		case "inbound_remarks":
			if m, ok := value.(map[string]any); ok {
				remarks := make(map[string]string, len(m))
				for k, v := range m {
					if s, ok := coerceString(v); ok {
						remarks[k] = s
					}
				}
				effective.InboundRemarks = remarks
			}
		case "telegram_backup_enabled":
			effective.TelegramBackupEnabled = truthy(value)
		case "telegram_bot_token":
			if text, ok := coerceString(value); ok {
				effective.TelegramBotToken = strings.TrimSpace(text)
			}
		case "telegram_chat_id":
			if text, ok := coerceString(value); ok {
				effective.TelegramChatID = strings.TrimSpace(text)
			}
		case "telegram_backup_interval":
			if text, ok := coerceString(value); ok {
				effective.TelegramBackupInterval = strings.TrimSpace(text)
			}
		}
	}

	if admin.SubscriptionDomain != nil {
		domain := strings.TrimSpace(*admin.SubscriptionDomain)
		if domain != "" {
			effective.SubscriptionURLPrefix = normalizePrefix(ensureScheme(domain))
		}
	} else {
		effective.SubscriptionURLPrefix = normalizePrefix(effective.SubscriptionURLPrefix)
	}
	return effective
}

func applyServicePlaceholderPolicy(settings SubscriptionSettings, servicePolicy *SubscriptionPlaceholderPolicy, raw json.RawMessage, serviceID *int64) SubscriptionSettings {
	if serviceID == nil || *serviceID <= 0 {
		return settings
	}
	if servicePolicy != nil {
		policy := *servicePolicy
		settings.SubscriptionPlaceholderPolicy = &policy
	}
	if len(raw) == 0 {
		return settings
	}
	var overrides struct {
		Placeholders map[string]SubscriptionPlaceholderPolicy `json:"subscription_placeholders"`
	}
	if json.Unmarshal(raw, &overrides) != nil {
		return settings
	}
	if policy, ok := overrides.Placeholders[strconv.FormatInt(*serviceID, 10)]; ok {
		settings.SubscriptionPlaceholderPolicy = &policy
	}
	return settings
}

func buildSubscriptionBases(settings SubscriptionSettings, salt string, requestOrigin string) []string {
	prefix := settings.SubscriptionURLPrefix
	if salt != "" {
		prefix = strings.ReplaceAll(prefix, "*", salt)
	}
	path := normalizePath(settings.SubscriptionPath)
	ports := normalizePorts(settings.SubscriptionPorts)

	if prefix == "" && len(ports) > 0 {
		prefix = requestOrigin
	}
	if prefix == "" {
		return []string{"/" + path}
	}

	bases := make([]string, 0, len(ports)+1)
	if len(ports) > 0 && strings.HasPrefix(prefix, "http") {
		if parsed, err := url.Parse(prefix); err == nil {
			host := parsed.Hostname()
			hostForNetloc := host
			if strings.Contains(host, ":") && !strings.HasPrefix(host, "[") {
				hostForNetloc = "[" + host + "]"
			}
			for _, port := range ports {
				netloc := hostForNetloc + ":" + strconv.Itoa(port)
				if parsed.User != nil {
					auth := parsed.User.Username()
					if password, ok := parsed.User.Password(); ok {
						auth += ":" + password
					}
					netloc = auth + "@" + netloc
				}
				alt := parsed.Scheme + "://" + netloc + parsed.EscapedPath()
				if parsed.RawQuery != "" {
					alt += "?" + parsed.RawQuery
				}
				if parsed.Fragment != "" {
					alt += "#" + parsed.Fragment
				}
				alt = strings.TrimRight(alt, "/") + "/" + path
				if !containsString(bases, alt) {
					bases = append(bases, alt)
				}
			}
			if len(bases) > 0 {
				return bases
			}
		}
	}

	base := strings.TrimRight(prefix, "/") + "/" + path
	if !containsString(bases, base) {
		bases = append([]string{base}, bases...)
	}
	if len(bases) == 0 {
		bases = append(bases, base)
	}
	return bases
}

func createSubscriptionToken(username string, secret string, now time.Time) string {
	timestamp := int64(math.Ceil(float64(now.UnixNano()) / 1_000_000_000))
	data := username + "," + strconv.FormatInt(timestamp, 10)
	dataB64 := base64.RawURLEncoding.EncodeToString([]byte(data))
	signature := createSubscriptionTokenSignature(dataB64, secret)
	if len(signature) > 10 {
		signature = signature[:10]
	}
	return dataB64 + signature
}

func createSubscriptionTokenSignature(body string, secret string) string {
	sum := sha256.Sum256([]byte(body + secret))
	signature := base64.URLEncoding.EncodeToString(sum[:])
	if len(signature) > 10 {
		return signature[:10]
	}
	return signature
}

func subscriptionTokenSignatureMatches(body string, signature string, secret string) bool {
	legacy := createSubscriptionTokenSignature(body, secret)
	if hmac.Equal([]byte(signature), []byte(legacy)) {
		return true
	}
	recentGo := createSubscriptionTokenHMACSignature(body, secret)
	return hmac.Equal([]byte(signature), []byte(recentGo))
}

func createSubscriptionTokenHMACSignature(body string, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(body))
	signature := base64.URLEncoding.EncodeToString(mac.Sum(nil))
	if len(signature) > 10 {
		return signature[:10]
	}
	return signature
}

func selectPrimaryLink(links OrderedStringMap, hasKey bool, hasSubadress bool, preferred string) string {
	if !hasKey {
		if value, ok := links.Get("subadress"); ok && value != "" {
			return value
		}
		value, _ := links.Get(subscriptionTypeToken)
		return value
	}
	if hasSubadress {
		value, _ := links.Get("subadress")
		return value
	}
	switch preferred {
	case subscriptionTypeKey:
		if value, ok := links.Get(subscriptionTypeKey); ok && value != "" {
			return value
		}
	case subscriptionTypeUsernameKey:
		if value, ok := links.Get(subscriptionTypeUsernameKey); ok && value != "" {
			return value
		}
	case subscriptionTypeKeyUsername:
		if value, ok := links.Get(subscriptionTypeKeyUsername); ok && value != "" {
			return value
		}
	case subscriptionTypeToken:
		value, _ := links.Get(subscriptionTypeToken)
		return value
	}
	value, _ := links.Get(subscriptionTypeToken)
	return value
}

func preferredType(explicit string, fallback string) string {
	value := strings.TrimSpace(explicit)
	if value == "" {
		value = strings.TrimSpace(fallback)
	}
	if value == "" {
		return subscriptionTypeKey
	}
	return value
}

func prefixLabel(prefix string) string {
	parsed, err := url.Parse(prefix)
	if err != nil {
		return prefix
	}
	if port := parsed.Port(); port != "" {
		return port
	}
	return prefix
}

func randomSalt() (string, error) {
	buffer := make([]byte, 8)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}

func isEmptyOverride(value any) bool {
	if value == nil {
		return true
	}
	if text, ok := value.(string); ok {
		return strings.TrimSpace(text) == ""
	}
	return false
}

func coerceString(value any) (string, bool) {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed), true
	case fmt.Stringer:
		return strings.TrimSpace(typed.String()), true
	default:
		return "", false
	}
}

func containsString(values []string, candidate string) bool {
	for _, value := range values {
		if value == candidate {
			return true
		}
	}
	return false
}

func copyStringMap(src map[string]string) map[string]string {
	if src == nil {
		return map[string]string{}
	}
	dst := make(map[string]string, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}
