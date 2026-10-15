package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	BotToken            string
	PanelURL            string
	PanelUsername       string
	PanelPassword       string
	PanelAPIKey         string
	AdminIDs            []int64
	DBPath              string
	DefaultPricePerGB   float64
	MinBalanceToStart   float64
	SyncIntervalSeconds int
	SupportUsername     string
	ChannelUsername     string
}

func LoadConfig() *Config {
	loadDotEnv(".env")

	cfg := &Config{
		BotToken:            getEnv("BOT_TOKEN", ""),
		PanelURL:            strings.TrimRight(getEnv("PANEL_URL", "http://127.0.0.1:8000"), "/"),
		PanelUsername:       getEnv("PANEL_USERNAME", "admin"),
		PanelPassword:       getEnv("PANEL_PASSWORD", ""),
		PanelAPIKey:         getEnv("PANEL_API_KEY", ""),
		DBPath:              getEnv("DATABASE_PATH", "bot.db"),
		DefaultPricePerGB:   getEnvFloat("PRICE_PER_GB", 5000),
		MinBalanceToStart:   getEnvFloat("MIN_BALANCE_TO_START", 5000),
		SyncIntervalSeconds: getEnvInt("SYNC_INTERVAL_SECONDS", 120),
		SupportUsername:     getEnv("SUPPORT_USERNAME", "@AdminSupport"),
		ChannelUsername:     getEnv("CHANNEL_USERNAME", ""),
	}

	rawAdmins := getEnv("ADMIN_IDS", "")
	if rawAdmins != "" {
		for _, part := range strings.Split(rawAdmins, ",") {
			part = strings.TrimSpace(part)
			if id, err := strconv.ParseInt(part, 10, 64); err == nil {
				cfg.AdminIDs = append(cfg.AdminIDs, id)
			}
		}
	}

	return cfg
}

func (c *Config) IsAdmin(tgID int64) bool {
	for _, id := range c.AdminIDs {
		if id == tgID {
			return true
		}
	}
	return false
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); strings.TrimSpace(val) != "" {
		return strings.TrimSpace(val)
	}
	return defaultVal
}

func getEnvFloat(key string, defaultVal float64) float64 {
	if val := os.Getenv(key); strings.TrimSpace(val) != "" {
		if f, err := strconv.ParseFloat(strings.TrimSpace(val), 64); err == nil {
			return f
		}
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); strings.TrimSpace(val) != "" {
		if i, err := strconv.Atoi(strings.TrimSpace(val)); err == nil {
			return i
		}
	}
	return defaultVal
}

func loadDotEnv(filepath string) {
	file, err := os.Open(filepath)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			v = strings.Trim(v, `"'`)
			if os.Getenv(k) == "" {
				_ = os.Setenv(k, v)
			}
		}
	}
}
