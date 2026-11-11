package stream

import (
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"tabletop/realtime/internal/hub"
	"tabletop/realtime/internal/token"
)

type Verifier interface {
	Verify(raw string) (token.Registration, error)
}

type Hub interface {
	Open(registration token.Registration) (*hub.Conn, error)
	ChangeTopics(connID string, registration token.Registration) error
	Close(conn *hub.Conn)
	Stats() hub.Stats
}

type Config struct {
	AllowedOrigins    []string
	KeepaliveInterval time.Duration
	WriteTimeout      time.Duration
}

type Handler struct {
	config   Config
	verifier Verifier
	hub      Hub
}

func NewHandler(config Config, verifier Verifier, hub Hub) http.Handler {
	h := &Handler{config: config, verifier: verifier, hub: hub}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /stream", h.stream)
	mux.HandleFunc("POST /stream/{connection}/topics", h.changeTopics)
	mux.HandleFunc("GET /health", h.health)
	return mux
}

var keepaliveFrame = []byte("event: keepalive\ndata: {}\n\n")

func (h *Handler) stream(w http.ResponseWriter, r *http.Request) {
	h.allowOrigin(w, r)

	registration, err := h.verifier.Verify(r.URL.Query().Get("t"))
	if err != nil {
		slog.Info("stream refused", "reason", err)
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := h.hub.Open(registration)
	switch {
	case errors.Is(err, hub.ErrRejected):
		slog.Info("stream refused", "account", registration.Account, "reason", err)
		http.Error(w, "token rejected", http.StatusUnauthorized)
		return
	case err != nil:
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}
	defer h.hub.Close(conn)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	writer := http.NewResponseController(w)
	if err := writer.Flush(); err != nil {
		return
	}

	keepalive := time.NewTicker(h.config.KeepaliveInterval)
	defer keepalive.Stop()
	for {
		var frame []byte
		select {
		case <-r.Context().Done():
			return
		case <-conn.Closed():
			if farewell := conn.Farewell(); farewell != nil {
				_ = h.write(w, writer, farewell)
			}
			return
		case frame = <-conn.Frames():
		case <-keepalive.C:
			frame = keepaliveFrame
		}
		if err := h.write(w, writer, frame); err != nil {
			return
		}
	}
}

func (h *Handler) changeTopics(w http.ResponseWriter, r *http.Request) {
	h.allowOrigin(w, r)

	registration, err := h.verifier.Verify(r.URL.Query().Get("t"))
	if err != nil {
		slog.Info("topic change refused", "reason", err)
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	err = h.hub.ChangeTopics(r.PathValue("connection"), registration)
	switch {
	case err == nil:
		w.WriteHeader(http.StatusAccepted)
	case errors.Is(err, hub.ErrUnknownConnection):
		http.Error(w, err.Error(), http.StatusNotFound)
	case errors.Is(err, hub.ErrRejected):
		slog.Info("topic change refused", "account", registration.Account, "reason", err)
		http.Error(w, "token rejected", http.StatusUnauthorized)
	default:
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
	}
}

func (h *Handler) write(w http.ResponseWriter, writer *http.ResponseController, frame []byte) error {
	if err := writer.SetWriteDeadline(time.Now().Add(h.config.WriteTimeout)); err != nil {
		return err
	}
	if _, err := w.Write(frame); err != nil {
		return err
	}
	return writer.Flush()
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if !h.hub.Stats().RedisConnected {
		http.Error(w, "redis subscriber not connected", http.StatusServiceUnavailable)
		return
	}
	_, _ = w.Write([]byte("ok\n"))
}

func (h *Handler) allowOrigin(w http.ResponseWriter, r *http.Request) {
	w.Header().Add("Vary", "Origin")
	if origin := r.Header.Get("Origin"); slices.Contains(h.config.AllowedOrigins, origin) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	}
}
