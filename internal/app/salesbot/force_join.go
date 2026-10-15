package salesbot

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
)

type joinCacheEntry struct {
	allowed bool
	expires time.Time
}

var joinCache sync.Map

func forceJoinEnabled() bool {
	switch strings.ToLower(strings.TrimSpace(GetSetting("force_join_enabled", "false"))) {
	case "true", "1", "yes", "on":
		return true
	}
	return false
}

func requiredChannelUsername() string {
	return strings.TrimSpace(GetSetting("channel_username", ""))
}

func isBotAdmin(userID int64) bool {
	raw := strings.TrimSpace(GetSetting("admin_ids", ""))
	if raw == "" {
		return false
	}
	for _, part := range strings.FieldsFunc(raw, func(r rune) bool { return r == ',' || r == ';' || r == ' ' || r == '\n' }) {
		id, err := strconv.ParseInt(strings.TrimSpace(part), 10, 64)
		if err == nil && id == userID {
			return true
		}
	}
	return false
}

// channelAllows reports whether the user may use the bot. It fails open on
// Telegram API errors so a misconfigured channel cannot lock everyone out.
func (s *Service) channelAllows(ctx context.Context, userID int64) bool {
	if !forceJoinEnabled() || isBotAdmin(userID) {
		return true
	}
	channel := requiredChannelUsername()
	if channel == "" {
		return true
	}
	if v, ok := joinCache.Load(userID); ok {
		if entry, ok := v.(joinCacheEntry); ok && time.Now().Before(entry.expires) {
			return entry.allowed
		}
	}

	status, err := s.tgClient.GetChatMember(ctx, s.botToken, channel, userID)
	if err != nil {
		joinCache.Store(userID, joinCacheEntry{allowed: true, expires: time.Now().Add(30 * time.Second)})
		return true
	}
	allowed := status == "creator" || status == "administrator" || status == "member" || status == "restricted"
	ttl := time.Minute
	if allowed {
		ttl = 10 * time.Minute
	}
	joinCache.Store(userID, joinCacheEntry{allowed: allowed, expires: time.Now().Add(ttl)})
	return allowed
}

func (s *Service) sendJoinRequired(ctx context.Context, chatID int64) {
	channel := requiredChannelUsername()
	link := strings.TrimSpace(GetSetting("channel_link", ""))
	if link == "" && channel != "" && !strings.HasPrefix(channel, "-") {
		link = "https://t.me/" + strings.TrimPrefix(channel, "@")
	}

	rows := [][]InlineKeyboardButton{}
	if link != "" {
		rows = append(rows, []InlineKeyboardButton{{Text: "📢 عضویت در کانال", URL: link}})
	}
	rows = append(rows, []InlineKeyboardButton{{Text: "✅ عضو شدم", CallbackData: "check_membership"}})

	text := fmt.Sprintf(
		"🔒 <b>عضویت در کانال الزامی است</b>\n\n"+
			"برای استفاده از ربات ابتدا در کانال زیر عضو شوید:\n👉 <b>%s</b>\n\n"+
			"پس از عضویت روی دکمه «✅ عضو شدم» بزنید.",
		channel,
	)
	_ = s.tgClient.SendMessage(ctx, s.botToken, chatID, text, InlineKeyboardMarkup{InlineKeyboard: rows})
}

func resetJoinCache(userID int64) {
	joinCache.Delete(userID)
}
