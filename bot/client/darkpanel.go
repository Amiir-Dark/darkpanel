package client

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

type PanelClient struct {
	BaseURL  string
	Username string
	Password string
	APIKey   string

	mu        sync.RWMutex
	token     string
	tokenTime time.Time
	client    *http.Client
}

type PanelUser struct {
	ID              int64    `json:"id"`
	Username        string   `json:"username"`
	Status          string   `json:"status"` // active, disabled, limited, expired
	UsedTraffic     int64    `json:"used_traffic"`
	DataLimit       int64    `json:"data_limit"`
	Expire          int64    `json:"expire"`
	SubscriptionURL string   `json:"subscription_url"`
	Links           []string `json:"links"`
}

type CreateUserResponse struct {
	Username        string   `json:"username"`
	Status          string   `json:"status"`
	SubscriptionURL string   `json:"subscription_url"`
	Links           []string `json:"links"`
}

func NewPanelClient(baseURL, username, password, apiKey string) *PanelClient {
	// Custom transport with TLS config to allow self-signed certs if needed
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	return &PanelClient{
		BaseURL:  strings.TrimRight(baseURL, "/"),
		Username: username,
		Password: password,
		APIKey:   apiKey,
		client:   &http.Client{Transport: tr, Timeout: 15 * time.Second},
	}
}

func (c *PanelClient) ensureToken(ctx context.Context) error {
	if c.APIKey != "" {
		return nil
	}

	c.mu.RLock()
	if c.token != "" && time.Since(c.tokenTime) < 12*time.Hour {
		c.mu.RUnlock()
		return nil
	}
	c.mu.RUnlock()

	c.mu.Lock()
	defer c.mu.Unlock()

	// Recheck under write lock
	if c.token != "" && time.Since(c.tokenTime) < 12*time.Hour {
		return nil
	}

	loginPayload := map[string]string{
		"username": c.Username,
		"password": c.Password,
	}
	body, _ := json.Marshal(loginPayload)

	// Try /api/admin/token first, fallback to /admin/token
	endpoints := []string{"/api/admin/token", "/admin/token"}
	var lastErr error

	for _, ep := range endpoints {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+ep, bytes.NewReader(body))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			var res struct {
				AccessToken string `json:"access_token"`
				Token       string `json:"token"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&res); err == nil {
				token := res.AccessToken
				if token == "" {
					token = res.Token
				}
				if token != "" {
					c.token = token
					c.tokenTime = time.Now()
					return nil
				}
			}
		}
		lastErr = fmt.Errorf("login failed with HTTP status: %d", resp.StatusCode)
	}

	return fmt.Errorf("panel authentication failed: %w", lastErr)
}

func (c *PanelClient) doRequest(ctx context.Context, method, endpoint string, body []byte) (*http.Response, error) {
	if err := c.ensureToken(ctx); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	if c.APIKey != "" {
		req.Header.Set("X-API-Key", c.APIKey)
	} else {
		c.mu.RLock()
		token := c.token
		c.mu.RUnlock()
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}

	// If 401 unauthorized and using token, clear token so next request re-authenticates
	if resp.StatusCode == http.StatusUnauthorized && c.APIKey == "" {
		c.mu.Lock()
		c.token = ""
		c.mu.Unlock()
	}

	return resp, nil
}

func (c *PanelClient) GetUser(ctx context.Context, username string) (*PanelUser, error) {
	resp, err := c.doRequest(ctx, http.MethodGet, "/api/user/"+username, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get user %q (status %d): %s", username, resp.StatusCode, string(body))
	}

	var user PanelUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}
	return &user, nil
}

func (c *PanelClient) CreateUser(ctx context.Context, username, note string) (*CreateUserResponse, error) {
	payload := map[string]any{
		"username":   username,
		"note":       note,
		"data_limit": 0, // Uncapped in panel because bot manages billing via Pay-As-You-Go
		"expire":     0,
		"status":     "active",
	}
	data, _ := json.Marshal(payload)

	resp, err := c.doRequest(ctx, http.MethodPost, "/api/user", data)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to create user %q (status %d): %s", username, resp.StatusCode, string(body))
	}

	var result CreateUserResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	// If subscription url is relative, make it absolute
	if strings.HasPrefix(result.SubscriptionURL, "/") {
		result.SubscriptionURL = c.BaseURL + result.SubscriptionURL
	}

	return &result, nil
}

func (c *PanelClient) SetUserStatus(ctx context.Context, username, status string) error {
	payload := map[string]string{
		"status": status,
	}
	data, _ := json.Marshal(payload)

	// Try /api/v2/users/{username} first, fallback to /api/user/{username}
	endpoints := []string{"/api/v2/users/" + username, "/api/user/" + username}
	var lastErr error

	for _, ep := range endpoints {
		resp, err := c.doRequest(ctx, http.MethodPut, ep, data)
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNoContent {
			return nil
		}
		body, _ := io.ReadAll(resp.Body)
		lastErr = fmt.Errorf("status %d: %s", resp.StatusCode, string(body))
	}

	return fmt.Errorf("failed to set user %q status to %q: %w", username, status, lastErr)
}

func (c *PanelClient) GetInbounds(ctx context.Context) (map[string]any, error) {
	resp, err := c.doRequest(ctx, http.MethodGet, "/api/inbounds", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get inbounds (status %d): %s", resp.StatusCode, string(body))
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *PanelClient) GetSystemStats(ctx context.Context) (map[string]any, error) {
	resp, err := c.doRequest(ctx, http.MethodGet, "/api/system", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get system stats (status %d): %s", resp.StatusCode, string(body))
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

