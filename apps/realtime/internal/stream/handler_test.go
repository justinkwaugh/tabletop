package stream

import (
	"bufio"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"tabletop/realtime/internal/hub"
	"tabletop/realtime/internal/token"
)

var issuedAt = time.Unix(1_800_000_000, 0)

const origin = "https://boardtogether.games"

type acceptAll struct{}

func (acceptAll) Subscribe(string) error   { return nil }
func (acceptAll) Unsubscribe(string) error { return nil }

type fakeVerifier map[string]token.Registration

func (f fakeVerifier) Verify(raw string) (token.Registration, error) {
	registration, ok := f[raw]
	if !ok {
		return token.Registration{}, token.ErrInvalid
	}
	return registration, nil
}

func newServer(t *testing.T, keepalive time.Duration) (*httptest.Server, *hub.Hub) {
	relayHub := hub.New(hub.Config{
		MaxConnections:           10,
		MaxConnectionsPerAccount: 10,
		ConnectionBuffer:         8,
		RevocationMemory:         time.Minute,
		SweepInterval:            time.Hour,
		Now:                      time.Now,
	}, acceptAll{})
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go relayHub.Run(ctx)

	verifier := fakeVerifier{"good": {
		Account:   "a",
		Topics:    []string{"game-1"},
		IssuedAt:  issuedAt,
		ExpiresAt: issuedAt.Add(time.Minute),
		ID:        "token-1",
	}}
	server := httptest.NewServer(NewHandler(Config{
		AllowedOrigins:    []string{origin},
		KeepaliveInterval: keepalive,
		WriteTimeout:      time.Second,
	}, verifier, relayHub))
	t.Cleanup(server.Close)
	return server, relayHub
}

func get(t *testing.T, ctx context.Context, url string) *http.Response {
	t.Helper()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Origin", origin)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	return response
}

func readFrame(t *testing.T, reader *bufio.Reader) string {
	t.Helper()
	var frame strings.Builder
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			t.Fatal(err)
		}
		frame.WriteString(line)
		if line == "\n" {
			return frame.String()
		}
	}
}

func TestAnInvalidTokenIsUnauthorized(t *testing.T) {
	server, relayHub := newServer(t, time.Minute)
	relayHub.RedisConnected(issuedAt)
	response := get(t, context.Background(), server.URL+"/stream?t=bad")
	defer response.Body.Close()
	if response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status %d", response.StatusCode)
	}
	if response.Header.Get("Access-Control-Allow-Origin") != origin {
		t.Fatal("missing CORS header on the refusal")
	}
}

func TestAReusedTokenIsUnauthorized(t *testing.T) {
	server, relayHub := newServer(t, time.Minute)
	relayHub.RedisConnected(issuedAt)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	first := get(t, ctx, server.URL+"/stream?t=good")
	defer first.Body.Close()
	second := get(t, context.Background(), server.URL+"/stream?t=good")
	defer second.Body.Close()
	if second.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status %d", second.StatusCode)
	}
}

func TestStreamsAreRefusedUntilRedisConnects(t *testing.T) {
	server, _ := newServer(t, time.Minute)
	response := get(t, context.Background(), server.URL+"/stream?t=good")
	defer response.Body.Close()
	if response.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status %d", response.StatusCode)
	}
}

func TestAStreamReceivesReadyThenMessages(t *testing.T) {
	server, relayHub := newServer(t, time.Minute)
	relayHub.RedisConnected(issuedAt)
	ctx, cancel := context.WithCancel(context.Background())
	response := get(t, ctx, server.URL+"/stream?t=good")
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK || response.Header.Get("Content-Type") != "text/event-stream" {
		t.Fatalf("status %d, content type %q", response.StatusCode, response.Header.Get("Content-Type"))
	}
	if response.Header.Get("Access-Control-Allow-Origin") != origin {
		t.Fatal("missing CORS header")
	}
	reader := bufio.NewReader(response.Body)

	relayHub.Subscribed("game-1")
	if frame := readFrame(t, reader); frame != "event: ready\ndata: {}\n\n" {
		t.Fatalf("first frame %q", frame)
	}
	relayHub.Published("game-1", `{"n":1}`)
	if frame := readFrame(t, reader); frame != "data: {\"topic\":\"game-1\",\"message\":{\"n\":1}}\n\n" {
		t.Fatalf("message frame %q", frame)
	}

	cancel()
	deadline := time.Now().Add(2 * time.Second)
	for relayHub.Stats().Connections != 0 {
		if time.Now().After(deadline) {
			t.Fatal("closed stream still registered")
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestAnIdleStreamGetsKeepalives(t *testing.T) {
	server, relayHub := newServer(t, 20*time.Millisecond)
	relayHub.RedisConnected(issuedAt)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	response := get(t, ctx, server.URL+"/stream?t=good")
	defer response.Body.Close()
	if frame := readFrame(t, bufio.NewReader(response.Body)); frame != ": keepalive\n\n" {
		t.Fatalf("frame %q", frame)
	}
}

func TestTheRelayClosingAConnectionEndsTheStream(t *testing.T) {
	server, relayHub := newServer(t, time.Minute)
	relayHub.RedisConnected(issuedAt)
	response := get(t, context.Background(), server.URL+"/stream?t=good")
	defer response.Body.Close()
	relayHub.RedisDisconnected()
	_, err := bufio.NewReader(response.Body).ReadString('\n')
	if !errors.Is(err, io.EOF) {
		t.Fatalf("got %v, want EOF", err)
	}
}

func TestHealthReflectsTheRedisSubscriber(t *testing.T) {
	server, relayHub := newServer(t, time.Minute)
	down := get(t, context.Background(), server.URL+"/health")
	down.Body.Close()
	relayHub.RedisConnected(issuedAt)
	up := get(t, context.Background(), server.URL+"/health")
	up.Body.Close()
	if down.StatusCode != http.StatusServiceUnavailable || up.StatusCode != http.StatusOK {
		t.Fatalf("health %d before redis, %d after", down.StatusCode, up.StatusCode)
	}
}
