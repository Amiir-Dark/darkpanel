package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"darkpanel-bot/billing"
	"darkpanel-bot/client"
	"darkpanel-bot/config"
	"darkpanel-bot/database"
	"darkpanel-bot/handlers"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

func main() {
	log.Println("==================================================")
	log.Println("     DarkPanel Pay-As-You-Go Telegram Bot         ")
	log.Println("==================================================")

	cfg := config.LoadConfig()
	if cfg.BotToken == "" {
		log.Fatal("FATAL: BOT_TOKEN is required. Please set it in .env file or environment variable.")
	}

	// 1. Initialize SQLite Database
	db, err := database.InitDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("FATAL: Failed to initialize database: %v", err)
	}
	defer db.Close()
	log.Printf("[DB] SQLite database initialized at %s", cfg.DBPath)

	// 2. Initialize DarkPanel API Client
	panelClient := client.NewPanelClient(cfg.PanelURL, cfg.PanelUsername, cfg.PanelPassword, cfg.PanelAPIKey)
	log.Printf("[Panel] DarkPanel API client configured for URL: %s", cfg.PanelURL)

	// 3. Initialize Telegram Bot
	bot, err := tgbotapi.NewBotAPI(cfg.BotToken)
	if err != nil {
		log.Fatalf("FATAL: Failed to connect to Telegram Bot API: %v", err)
	}
	log.Printf("[Bot] Authorized on account @%s (ID: %d)", bot.Self.UserName, bot.Self.ID)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 4. Start Pay-As-You-Go Background Engine
	paygEngine := billing.NewPAYGEngine(db, panelClient, cfg, bot)
	go paygEngine.Start(ctx)

	// 5. Initialize Telegram Update Handlers
	handler := handlers.NewBotHandler(bot, db, panelClient, cfg)

	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60
	updates := bot.GetUpdatesChan(u)

	// 6. Graceful shutdown handler
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("[Bot] Received termination signal, shutting down...")
		cancel()
		bot.StopReceivingUpdates()
		os.Exit(0)
	}()

	log.Println("[Bot] Listening for updates...")
	for update := range updates {
		handler.HandleUpdate(update)
	}
}
