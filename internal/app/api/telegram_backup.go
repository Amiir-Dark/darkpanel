package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	backupapp "github.com/rebeccapanel/rebecca/internal/app/backup"
	"github.com/rebeccapanel/rebecca/internal/app/logging"
	telegramapp "github.com/rebeccapanel/rebecca/internal/app/telegram"
	userapp "github.com/rebeccapanel/rebecca/internal/app/user"
)

const defaultTelegramBackupCheckInterval = time.Minute

func (s *Server) handleTelegramBackupSend(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/settings/telegram/backup/send" {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if !s.isBinaryRuntime() {
		writeError(w, http.StatusConflict, backupapp.DisabledDetail)
		return
	}
	var payload struct {
		Scope string `json:"scope"`
	}
	if err := decodeOptionalJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	result, err := s.telegramBackupDelivery().Send(r.Context(), s.backup(), payload.Scope)
	if err != nil {
		writeTelegramBackupError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) runTelegramBackupScheduler(ctx context.Context) {
	ticker := time.NewTicker(defaultTelegramBackupCheckInterval)
	defer ticker.Stop()

	s.runTelegramBackupOnce(ctx)
	s.runResellerTelegramBackups(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.runTelegramBackupOnce(ctx)
			s.runResellerTelegramBackups(ctx)
		}
	}
}

func (s *Server) runResellerTelegramBackups(ctx context.Context) {
	bundle, err := s.settingsRepo.SubscriptionBundle(ctx)
	if err != nil {
		return
	}
	for _, adm := range bundle.Admins {
		if len(adm.SubscriptionSettings) == 0 {
			continue
		}
		raw := adm.SubscriptionSettings
		enabled, _ := raw["telegram_backup_enabled"].(bool)
		if !enabled {
			continue
		}
		botToken, _ := raw["telegram_bot_token"].(string)
		chatID, _ := raw["telegram_chat_id"].(string)
		botToken = strings.TrimSpace(botToken)
		chatID = strings.TrimSpace(chatID)
		if botToken == "" || chatID == "" {
			continue
		}

		intervalStr, _ := raw["telegram_backup_interval"].(string)
		interval := 24 * time.Hour
		switch strings.ToLower(strings.TrimSpace(intervalStr)) {
		case "12h", "12":
			interval = 12 * time.Hour
		case "weekly", "7d", "168h":
			interval = 7 * 24 * time.Hour
		case "daily", "24h", "24":
			interval = 24 * time.Hour
		}

		lastSentStr, _ := raw["telegram_backup_last_sent_at"].(string)
		if lastSentStr != "" {
			if lastSent, err := time.Parse(time.RFC3339, lastSentStr); err == nil {
				if time.Since(lastSent) < interval {
					continue
				}
			}
		}

		limit := int64(100000)
		usersResp, err := s.userService.UsersList(ctx, userapp.UsersListRequest{
			Admin: userapp.AdminContext{
				ID:       &adm.ID,
				Role:     "reseller",
				Username: adm.Username,
			},
			Limit: &limit,
		})
		if err != nil {
			logging.Warnf(logging.ComponentTelegram, "reseller %s backup users fetch failed: %v", adm.Username, err)
			continue
		}

		payloadData, err := json.MarshalIndent(map[string]any{
			"exported_at": time.Now().UTC().Format(time.RFC3339),
			"reseller_id": adm.ID,
			"reseller":    adm.Username,
			"users_count": len(usersResp.Users),
			"users":       usersResp.Users,
		}, "", "  ")
		if err != nil {
			continue
		}

		filename := fmt.Sprintf("backup_%s_%s.json", adm.Username, time.Now().Format("20060102_150405"))
		caption := fmt.Sprintf("📦 <b>DarkPanel Reseller Scheduled Backup</b>\n\n👤 Reseller: <b>%s</b>\n👥 Total Users: <b>%d</b>\n📅 Date: %s",
			telegramapp.EscapeHTML(adm.Username),
			len(usersResp.Users),
			time.Now().Format("2006-01-02 15:04:05"),
		)

		if err := s.telegramSender.SendDirectDocument(ctx, botToken, chatID, filename, caption, payloadData); err != nil {
			logging.Warnf(logging.ComponentTelegram, "reseller %s scheduled backup telegram send failed: %v", adm.Username, err)
			continue
		}

		raw["telegram_backup_last_sent_at"] = time.Now().UTC().Format(time.RFC3339)
		rawBytes, _ := json.Marshal(raw)
		var rawMap map[string]json.RawMessage
		_ = json.Unmarshal(rawBytes, &rawMap)
		_, _ = s.settingsRepo.UpdateAdminSubscriptionSettings(ctx, adm.ID, rawMap)
		logging.Infof(logging.ComponentTelegram, "reseller %s scheduled backup delivered successfully", adm.Username)
	}
}

func (s *Server) runTelegramBackupOnce(ctx context.Context) {
	if s.telegramRepoEmpty() {
		return
	}
	settings, err := s.telegramRepo.Settings(ctx)
	if err != nil {
		logging.Warnf(logging.ComponentTelegram, "backup settings lookup failed: %v", err)
		return
	}
	if !telegramapp.BackupDue(settings, time.Now().UTC()) {
		return
	}
	if !s.isBinaryRuntime() {
		_ = s.telegramRepo.RecordBackupError(ctx, backupapp.DisabledDetail)
		s.telegramBackupDelivery().SendFailureReport(ctx, settings.BackupScope, errors.New(backupapp.DisabledDetail))
		return
	}
	if _, err := s.telegramBackupDelivery().Send(ctx, s.backup(), settings.BackupScope); err != nil {
		logging.Warnf(logging.ComponentTelegram, "backup delivery failed: %v", err)
		return
	}
	logging.Infof(logging.ComponentTelegram, "backup delivered scope=%s", firstNonEmpty(settings.BackupScope, backupapp.ScopeDatabase))
}

func (s *Server) telegramBackupDelivery() telegramapp.BackupDelivery {
	if s.telegramBackup.IsZero() {
		s.telegramBackup = telegramapp.NewBackupDelivery(s.telegramRepo, s.telegramSender)
	}
	return s.telegramBackup
}

func (s *Server) telegramRepoEmpty() bool {
	return s.telegramRepo == (telegramapp.Repository{})
}

func writeTelegramBackupError(w http.ResponseWriter, err error) {
	status := http.StatusBadGateway
	if errors.Is(err, telegramapp.ErrNotConfigured) || errors.Is(err, telegramapp.ErrNoRecipient) || strings.Contains(strings.ToLower(err.Error()), "proxy") {
		status = http.StatusBadRequest
	}
	var backupErr backupapp.Error
	if errors.As(err, &backupErr) {
		status = http.StatusBadRequest
	}
	writeError(w, status, err.Error())
}
