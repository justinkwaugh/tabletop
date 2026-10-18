package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"tabletop/realtime/internal/bus"
	"tabletop/realtime/internal/config"
	"tabletop/realtime/internal/hub"
	"tabletop/realtime/internal/stream"
	"tabletop/realtime/internal/token"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("realtime relay stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.FromEnv()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	redisBus := bus.New(bus.Config{
		Options: &redis.Options{
			Addr:     cfg.RedisAddr,
			Username: cfg.RedisUsername,
			Password: cfg.RedisPassword,
			Protocol: 2,
		},
		PingInterval:   10 * time.Second,
		ReceiveTimeout: 30 * time.Second,
		CommandTimeout: 2 * time.Second,
		MinBackoff:     time.Second,
		MaxBackoff:     30 * time.Second,
		Now:            time.Now,
	})
	relayHub := hub.New(hub.Config{
		MaxConnections:           cfg.MaxConnections,
		MaxConnectionsPerAccount: cfg.MaxConnectionsPerAccount,
		ConnectionBuffer:         64,
		RevocationMemory:         token.MaxLifetime + token.ClockLeeway + time.Second,
		SweepInterval:            10 * time.Second,
		Now:                      time.Now,
	}, redisBus)
	redisBus.SetListener(relayHub)

	streamServer := &http.Server{
		Addr: cfg.Listen,
		Handler: stream.NewHandler(stream.Config{
			AllowedOrigins:    cfg.AllowedOrigins,
			KeepaliveInterval: 25 * time.Second,
			WriteTimeout:      10 * time.Second,
		}, token.NewVerifier(cfg.SigningKeys, time.Now), relayHub),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}
	statsServer := &http.Server{
		Addr:              cfg.StatsListen,
		Handler:           statsHandler(relayHub),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go relayHub.Run(ctx)
	go redisBus.Run(ctx)
	serverErrors := make(chan error, 2)
	go serve(streamServer, serverErrors)
	go serve(statsServer, serverErrors)
	slog.Info("realtime relay listening", "stream", cfg.Listen, "stats", cfg.StatsListen)

	select {
	case <-ctx.Done():
	case err = <-serverErrors:
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	stop()
	_ = statsServer.Shutdown(shutdownCtx)
	_ = streamServer.Shutdown(shutdownCtx)
	return err
}

func serve(server *http.Server, errs chan<- error) {
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		errs <- err
	}
}

func statsHandler(relayHub *hub.Hub) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		var memory runtime.MemStats
		runtime.ReadMemStats(&memory)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(struct {
			hub.Stats
			Goroutines  int    `json:"goroutines"`
			HeapBytes   uint64 `json:"heapBytes"`
			SystemBytes uint64 `json:"systemBytes"`
		}{relayHub.Stats(), runtime.NumGoroutine(), memory.HeapAlloc, memory.Sys})
	})
}
