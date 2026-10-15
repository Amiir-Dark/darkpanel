package salesbot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"golang.org/x/net/proxy"
)

type TelegramClient struct {
	httpClient *http.Client
	apiBase    string
}

func NewTelegramClient() *TelegramClient {
	apiBase := strings.TrimRight(strings.TrimSpace(GetSetting("telegram_api_base", "")), "/")
	if apiBase == "" {
		apiBase = "https://api.telegram.org"
	}

	proxyURL := strings.TrimSpace(GetSetting("telegram_proxy", ""))
	if proxyURL == "" {
		proxyURL = strings.TrimSpace(os.Getenv("TELEGRAM_PROXY"))
	}
	if proxyURL == "" {
		proxyURL = strings.TrimSpace(os.Getenv("ALL_PROXY"))
	}
	if proxyURL == "" {
		proxyURL = strings.TrimSpace(os.Getenv("HTTPS_PROXY"))
	}

	client := httpClientForProxy(proxyURL, 45*time.Second)

	return &TelegramClient{
		httpClient: client,
		apiBase:    apiBase,
	}
}

func httpClientForProxy(proxyURL string, timeout time.Duration) *http.Client {
	if proxyURL == "" {
		return &http.Client{Timeout: timeout}
	}
	parsed, err := url.Parse(proxyURL)
	if err != nil {
		return &http.Client{Timeout: timeout}
	}
	transport := &http.Transport{}
	switch strings.ToLower(parsed.Scheme) {
	case "http", "https":
		transport.Proxy = http.ProxyURL(parsed)
	case "socks5", "socks5h":
		dialer, err := proxy.FromURL(parsed, proxy.Direct)
		if err == nil {
			if contextDialer, ok := dialer.(proxy.ContextDialer); ok {
				transport.DialContext = contextDialer.DialContext
			} else {
				transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
					return dialer.Dial(network, address)
				}
			}
		}
	}
	return &http.Client{Timeout: timeout, Transport: transport}
}

type BotUser struct {
	ID        int64  `json:"id"`
	IsBot     bool   `json:"is_bot"`
	FirstName string `json:"first_name"`
	Username  string `json:"username"`
}

type Update struct {
	UpdateID      int64          `json:"update_id"`
	Message       *Message       `json:"message,omitempty"`
	CallbackQuery *CallbackQuery `json:"callback_query,omitempty"`
}

type Message struct {
	MessageID int64       `json:"message_id"`
	From      *FromUser   `json:"from,omitempty"`
	Chat      Chat        `json:"chat"`
	Text      string      `json:"text,omitempty"`
	Photo     []PhotoSize `json:"photo,omitempty"`
	Caption   string      `json:"caption,omitempty"`
	Date      int64       `json:"date"`
}

type FromUser struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	Username  string `json:"username,omitempty"`
}

type Chat struct {
	ID        int64  `json:"id"`
	Type      string `json:"type"`
	Username  string `json:"username,omitempty"`
	FirstName string `json:"first_name,omitempty"`
}

type PhotoSize struct {
	FileID   string `json:"file_id"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	FileSize int    `json:"file_size"`
}

type CallbackQuery struct {
	ID      string   `json:"id"`
	From    FromUser `json:"from"`
	Message *Message `json:"message,omitempty"`
	Data    string   `json:"data"`
}

type ReplyKeyboardMarkup struct {
	Keyboard       [][]KeyboardButton `json:"keyboard"`
	ResizeKeyboard bool               `json:"resize_keyboard"`
	IsPersistent   bool               `json:"is_persistent,omitempty"`
}

type KeyboardButton struct {
	Text string `json:"text"`
}

type InlineKeyboardMarkup struct {
	InlineKeyboard [][]InlineKeyboardButton `json:"inline_keyboard"`
}

type InlineKeyboardButton struct {
	Text         string `json:"text"`
	CallbackData string `json:"callback_data,omitempty"`
	URL          string `json:"url,omitempty"`
}

type apiResponse struct {
	OK          bool            `json:"ok"`
	Description string          `json:"description,omitempty"`
	ErrorCode   int             `json:"error_code,omitempty"`
	Result      json.RawMessage `json:"result,omitempty"`
}

func (c *TelegramClient) call(ctx context.Context, token, method string, payload any) (json.RawMessage, error) {
	if strings.TrimSpace(token) == "" {
		return nil, fmt.Errorf("bot token is empty")
	}

	url := fmt.Sprintf("%s/bot%s/%s", c.apiBase, token, method)
	var bodyReader io.Reader
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bodyReader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var apiResp apiResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, err
	}

	if !apiResp.OK {
		return nil, fmt.Errorf("telegram api error (%d): %s", apiResp.ErrorCode, apiResp.Description)
	}

	return apiResp.Result, nil
}

func (c *TelegramClient) GetMe(ctx context.Context, token string) (*BotUser, error) {
	raw, err := c.call(ctx, token, "getMe", nil)
	if err != nil {
		return nil, err
	}
	var u BotUser
	if err := json.Unmarshal(raw, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

func (c *TelegramClient) GetUpdates(ctx context.Context, token string, offset int64, timeout int) ([]Update, error) {
	payload := map[string]any{
		"timeout":         timeout,
		"allowed_updates": []string{"message", "callback_query"},
	}
	if offset > 0 {
		payload["offset"] = offset
	}

	raw, err := c.call(ctx, token, "getUpdates", payload)
	if err != nil {
		return nil, err
	}

	var updates []Update
	if err := json.Unmarshal(raw, &updates); err != nil {
		return nil, err
	}
	return updates, nil
}

func (c *TelegramClient) DeleteWebhook(ctx context.Context, token string) error {
	payload := map[string]any{
		"drop_pending_updates": false,
	}
	_, err := c.call(ctx, token, "deleteWebhook", payload)
	return err
}

func (c *TelegramClient) SendMessage(ctx context.Context, token string, chatID int64, text string, replyMarkup any) error {
	payload := map[string]any{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "HTML",
	}
	if replyMarkup != nil {
		payload["reply_markup"] = replyMarkup
	}
	_, err := c.call(ctx, token, "sendMessage", payload)
	if err != nil && strings.Contains(err.Error(), "can't parse entities") {
		// Fallback: send as plain text if HTML tags were rejected by Telegram
		delete(payload, "parse_mode")
		_, err = c.call(ctx, token, "sendMessage", payload)
	}
	return err
}

func (c *TelegramClient) AnswerCallbackQuery(ctx context.Context, token string, queryID, text string) error {
	payload := map[string]any{
		"callback_query_id": queryID,
		"text":              text,
	}
	_, err := c.call(ctx, token, "answerCallbackQuery", payload)
	return err
}

