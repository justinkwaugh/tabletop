package stream

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"tabletop/realtime/internal/hub"
	"tabletop/realtime/internal/token"
)

var (
	connectedAt = time.Unix(1_800_000_000, 0)
	issuedAt    = connectedAt.Add(time.Second)
)

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

func newServer(t *testing.T, keepalive time.Duration, adjust ...func(*hub.Config)) (*httptest.Server, *hub.Hub) {
	config := hub.Config{
		MaxConnections:           10,
		MaxConnectionsPerAccount: 10,
		ConnectionBuffer:         8,
		RevocationMemory:         time.Minute,
		SweepInterval:            time.Hour,
		Now:                      time.Now,
	}
	for _, change := range adjust {
		change(&config)
	}
	relayHub := hub.New(config, acceptAll{})
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go relayHub.Run(ctx)

	verifier := fakeVerifier{
		"good": {
			Account:   "a",
			Topics:    []string{"game-1"},
			IssuedAt:  issuedAt,
			ExpiresAt: issuedAt.Add(time.Minute),
			ID:        "token-1",
		},
		"more": {
			Account:   "a",
			Topics:    []string{"game-1", "game-2"},
			IssuedAt:  issuedAt,
			ExpiresAt: issuedAt.Add(time.Minute),
			ID:        "token-2",
		},
	}
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

type readyEvent struct {
	Connection string   `json:"connection"`
	Topics     []string `json:"topics"`
}

func readReady(t *testing.T, reader *bufio.Reader) readyEvent {
	t.Helper()
	frame := readFrame(t, reader)
	body, found := strings.CutPrefix(frame, "event: ready\ndata: ")
	if !found {
		t.Fatalf("expected a ready event, got %q", frame)
	}
	var event readyEvent
	if err := json.Unmarshal([]byte(strings.TrimSpace(body)), &event); err != nil {
		t.Fatal(err)
	}
	return event
}

func post(t *testing.T, url string) *http.Response {
	t.Helper()
	request, err := http.NewRequest(http.MethodPost, url, nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Origin", origin)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
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
	relayHub.RedisConnected(connectedAt)
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
	relayHub.RedisConnected(connectedAt)
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
	relayHub.RedisConnected(connectedAt)
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
	ready := readReady(t, reader)
	if ready.Connection == "" || !slices.Equal(ready.Topics, []string{"game-1"}) {
		t.Fatalf("first ready %+v", ready)
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

func TestTopicsChangeOnTheOpenStream(t *testing.T) {
	server, relayHub := newServer(t, time.Minute)
	relayHub.RedisConnected(connectedAt)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	response := get(t, ctx, server.URL+"/stream?t=good")
	defer response.Body.Close()
	reader := bufio.NewReader(response.Body)
	relayHub.Subscribed("game-1")
	connection := readReady(t, reader).Connection

	for path, want := range map[string]int{
		"/stream/" + connection + "/topics?t=bad": http.StatusUnauthorized,
		"/stream/elsewhere/topics?t=more":         http.StatusNotFound,
	} {
		refused := post(t, server.URL+path)
		if refused.StatusCode != want || refused.Header.Get("Access-Control-Allow-Origin") != origin {
			t.Fatalf("%s: status %d", path, refused.StatusCode)
		}
	}

	changed := post(t, server.URL+"/stream/"+connection+"/topics?t=more")
	if changed.StatusCode != http.StatusAccepted {
		t.Fatalf("topic change status %d", changed.StatusCode)
	}
	relayHub.Subscribed("game-2")
	ready := readReady(t, reader)
	if ready.Connection != "" || !slices.Equal(ready.Topics, []string{"game-1", "game-2"}) {
		t.Fatalf("second ready %+v", ready)
	}
}

func TestAnIdleStreamGetsKeepalives(t *testing.T) {
	server, relayHub := newServer(t, 20*time.Millisecond)
	relayHub.RedisConnected(connectedAt)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	response := get(t, ctx, server.URL+"/stream?t=good")
	defer response.Body.Close()
	if frame := readFrame(t, bufio.NewReader(response.Body)); frame != "event: keepalive\ndata: {}\n\n" {
		t.Fatalf("frame %q", frame)
	}
}

func TestTheRelayClosingAConnectionEndsTheStream(t *testing.T) {
	server, relayHub := newServer(t, time.Minute)
	relayHub.RedisConnected(connectedAt)
	response := get(t, context.Background(), server.URL+"/stream?t=good")
	defer response.Body.Close()
	relayHub.RedisDisconnected()
	_, err := bufio.NewReader(response.Body).ReadString('\n')
	if !errors.Is(err, io.EOF) {
		t.Fatalf("got %v, want EOF", err)
	}
}

func TestAnEvictedStreamIsToldWhyBeforeItEnds(t *testing.T) {
	server, relayHub := newServer(t, time.Minute, func(c *hub.Config) { c.MaxConnectionsPerAccount = 1 })
	relayHub.RedisConnected(connectedAt)
	first := get(t, context.Background(), server.URL+"/stream?t=good")
	defer first.Body.Close()
	relayHub.Subscribed("game-1")
	reader := bufio.NewReader(first.Body)
	readReady(t, reader)

	second := get(t, context.Background(), server.URL+"/stream?t=more")
	defer second.Body.Close()
	if frame := readFrame(t, reader); frame != "event: evicted\ndata: {}\n\n" {
		t.Fatalf("frame %q", frame)
	}
	if _, err := reader.ReadString('\n'); !errors.Is(err, io.EOF) {
		t.Fatalf("got %v, want EOF", err)
	}
}

func TestHealthReflectsTheRedisSubscriber(t *testing.T) {
	server, relayHub := newServer(t, time.Minute)
	down := get(t, context.Background(), server.URL+"/health")
	down.Body.Close()
	relayHub.RedisConnected(connectedAt)
	up := get(t, context.Background(), server.URL+"/health")
	up.Body.Close()
	if down.StatusCode != http.StatusServiceUnavailable || up.StatusCode != http.StatusOK {
		t.Fatalf("health %d before redis, %d after", down.StatusCode, up.StatusCode)
	}
}
