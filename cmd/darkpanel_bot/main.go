package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/rebeccapanel/rebecca/internal/app/salesbot"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	svc := salesbot.GetService()
	if err := svc.Start(ctx); err != nil {
		log.Printf("sales bot: %v (configure bot_token in panel settings)", err)
	}

	<-ctx.Done()
	_ = svc.Stop()
}
