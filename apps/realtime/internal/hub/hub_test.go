package hub

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"tabletop/realtime/internal/token"
)

var connectedAt = time.Unix(1_800_000_000, 0)

type fakeSubscriptions struct {
	mu       sync.Mutex
	requests []string
}

func (f *fakeSubscriptions) Subscribe(topic string) error {
	f.record("subscribe " + topic)
	return nil
}

func (f *fakeSubscriptions) Unsubscribe(topic string) error {
	f.record("unsubscribe " + topic)
	return nil
}

func (f *fakeSubscriptions) record(request string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.requests = append(f.requests, request)
}

func (f *fakeSubscriptions) taken() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	taken := f.requests
	f.requests = nil
	return taken
}

type harness struct {
	t             *testing.T
	hub           *Hub
	subscriptions *fakeSubscriptions
	nextToken     int
}

func newHarness(t *testing.T, configure ...func(*Config)) *harness {
	config := Config{
		MaxConnections:           100,
		MaxConnectionsPerAccount: 50,
		ConnectionBuffer:         8,
		RevocationMemory:         time.Minute,
		SweepInterval:            time.Hour,
		Now:                      func() time.Time { return connectedAt },
	}
	for _, change := range configure {
		change(&config)
	}
	subscriptions := &fakeSubscriptions{}
	h := New(config, subscriptions)
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go h.Run(ctx)
	h.RedisConnected(connectedAt)
	return &harness{t: t, hub: h, subscriptions: subscriptions}
}

func (h *harness) registration(account string, topics ...string) token.Registration {
	h.nextToken++
	return token.Registration{
		Account:   account,
		Topics:    topics,
		IssuedAt:  connectedAt,
		ExpiresAt: connectedAt.Add(time.Minute),
		ID:        fmt.Sprintf("token-%d", h.nextToken),
	}
}

func (h *harness) open(account string, topics ...string) *Conn {
	h.t.Helper()
	conn, err := h.hub.Open(h.registration(account, topics...))
	if err != nil {
		h.t.Fatal(err)
	}
	return conn
}

func (h *harness) settle() {
	h.hub.Stats()
}

func (h *harness) expectRequests(want ...string) {
	h.t.Helper()
	h.settle()
	if got := h.subscriptions.taken(); !slices.Equal(got, want) {
		h.t.Fatalf("redis requests %v, want %v", got, want)
	}
}

func frames(conn *Conn) []string {
	var received []string
	for {
		select {
		case frame := <-conn.Frames():
			received = append(received, string(frame))
		default:
			return received
		}
	}
}

func expectFrames(t *testing.T, conn *Conn, want ...string) {
	t.Helper()
	if got := frames(conn); !slices.Equal(got, want) {
		t.Fatalf("frames %q, want %q", got, want)
	}
}

func isClosed(conn *Conn) bool {
	select {
	case <-conn.Closed():
		return true
	default:
		return false
	}
}

const ready = "event: ready\ndata: {}\n\n"

func message(topic, payload string) string {
	return fmt.Sprintf("data: {\"topic\":%q,\"message\":%s}\n\n", topic, payload)
}

func TestReadyOnlyAfterEveryTopicIsConfirmed(t *testing.T) {
	h := newHarness(t)
	conn := h.open("a", "game-1", "global")
	h.expectRequests("subscribe game-1", "subscribe global")

	h.hub.Subscribed("game-1")
	h.settle()
	expectFrames(t, conn)

	h.hub.Subscribed("global")
	h.settle()
	expectFrames(t, conn, ready)
}

func TestMessagesBeforeReadyAreDropped(t *testing.T) {
	h := newHarness(t)
	conn := h.open("a", "game-1", "global")
	h.hub.Subscribed("game-1")
	h.hub.Published("game-1", `{"early":true}`)
	h.hub.Subscribed("global")
	h.hub.Published("game-1", `{"late":true}`)
	h.settle()
	expectFrames(t, conn, ready, message("game-1", `{"late":true}`))
}

func TestASharedTopicIsSubscribedOnceAndFannedOut(t *testing.T) {
	h := newHarness(t)
	first := h.open("a", "game-1")
	second := h.open("b", "game-1")
	h.expectRequests("subscribe game-1")

	h.hub.Subscribed("game-1")
	h.hub.Published("game-1", `{"n":1}`)
	h.settle()
	expectFrames(t, first, ready, message("game-1", `{"n":1}`))
	expectFrames(t, second, ready, message("game-1", `{"n":1}`))
}

func TestAConnectionWaitsForASubscriptionAnotherRequested(t *testing.T) {
	h := newHarness(t)
	first := h.open("a", "game-1")
	second := h.open("b", "game-1")
	h.settle()
	expectFrames(t, first)
	expectFrames(t, second)

	h.hub.Subscribed("game-1")
	h.settle()
	expectFrames(t, first, ready)
	expectFrames(t, second, ready)
}

func TestAConfirmedTopicMakesANewConnectionReadyAtOnce(t *testing.T) {
	h := newHarness(t)
	h.open("a", "game-1")
	h.hub.Subscribed("game-1")
	second := h.open("b", "game-1")
	h.expectRequests("subscribe game-1")
	expectFrames(t, second, ready)
}

func TestResubscribingWhileAnUnsubscribeIsInFlight(t *testing.T) {
	h := newHarness(t)
	first := h.open("a", "game-1")
	h.hub.Subscribed("game-1")
	h.hub.Close(first)
	second := h.open("b", "game-1")
	h.expectRequests("subscribe game-1", "unsubscribe game-1", "subscribe game-1")

	h.hub.Unsubscribed("game-1")
	h.settle()
	expectFrames(t, second)

	h.hub.Subscribed("game-1")
	h.settle()
	expectFrames(t, second, ready)
}

func TestTheLastConnectionUnsubscribes(t *testing.T) {
	h := newHarness(t)
	first := h.open("a", "game-1")
	second := h.open("b", "game-1")
	h.hub.Subscribed("game-1")
	h.hub.Close(first)
	h.expectRequests("subscribe game-1")
	h.hub.Close(second)
	h.expectRequests("unsubscribe game-1")
	h.hub.Unsubscribed("game-1")
	if topics := h.hub.Stats().Topics; topics != 0 {
		t.Fatalf("%d topics left", topics)
	}
}

func TestASlowConnectionIsDropped(t *testing.T) {
	h := newHarness(t, func(c *Config) { c.ConnectionBuffer = 2 })
	slow := h.open("a", "game-1")
	h.hub.Subscribed("game-1")
	for i := range 3 {
		h.hub.Published("game-1", fmt.Sprintf(`{"n":%d}`, i))
	}
	h.settle()
	if !isClosed(slow) {
		t.Fatal("slow connection was not dropped")
	}
	h.expectRequests("subscribe game-1", "unsubscribe game-1")
}

func TestTheAccountLimitClosesTheOldestConnection(t *testing.T) {
	h := newHarness(t, func(c *Config) { c.MaxConnectionsPerAccount = 2 })
	oldest := h.open("a", "global")
	middle := h.open("a", "global")
	other := h.open("b", "global")
	newest := h.open("a", "global")
	h.settle()
	if !isClosed(oldest) || isClosed(middle) || isClosed(newest) || isClosed(other) {
		t.Fatal("expected only the oldest connection of account a to close")
	}
	if stats := h.hub.Stats(); stats.Connections != 3 || stats.Accounts != 2 {
		t.Fatalf("unexpected stats %+v", stats)
	}
}

func TestTheRelayLimitRefusesNewConnections(t *testing.T) {
	h := newHarness(t, func(c *Config) { c.MaxConnections = 1 })
	h.open("a", "global")
	if _, err := h.hub.Open(h.registration("b", "global")); !errors.Is(err, ErrAtCapacity) {
		t.Fatalf("got %v, want ErrAtCapacity", err)
	}
}

func TestATokenIsUsedOnce(t *testing.T) {
	h := newHarness(t)
	registration := h.registration("a", "global")
	if _, err := h.hub.Open(registration); err != nil {
		t.Fatal(err)
	}
	if _, err := h.hub.Open(registration); !errors.Is(err, ErrRejected) {
		t.Fatalf("got %v, want ErrRejected", err)
	}
}

func TestUsedTokensAreForgottenAfterTheyExpire(t *testing.T) {
	now := connectedAt
	h := newHarness(t, func(c *Config) { c.Now = func() time.Time { return now } })
	h.open("a", "global")
	now = connectedAt.Add(2 * time.Minute)
	h.hub.await(h.hub.sweep)
	if used := len(h.hub.usedTokens); used != 0 {
		t.Fatalf("%d used tokens remembered", used)
	}
}

func TestRevocationClosesConnectionsAndRejectsOlderTokens(t *testing.T) {
	h := newHarness(t)
	revoked := h.open("a", "global")
	kept := h.open("b", "global")
	older := h.registration("a", "global")

	h.hub.Published(token.ControlChannel, fmt.Sprintf(`{"revoke":"a","at":%d.5}`, connectedAt.Unix()))
	h.settle()
	if !isClosed(revoked) || isClosed(kept) {
		t.Fatal("expected only account a's connection to close")
	}
	if _, err := h.hub.Open(older); !errors.Is(err, ErrRejected) {
		t.Fatalf("got %v, want ErrRejected", err)
	}

	newer := h.registration("a", "global")
	newer.IssuedAt = connectedAt.Add(time.Second)
	if _, err := h.hub.Open(newer); err != nil {
		t.Fatalf("token issued after the revocation refused: %v", err)
	}
}

func TestControlMessagesAreNeverForwarded(t *testing.T) {
	h := newHarness(t)
	conn := h.open("a", "global")
	h.hub.Subscribed("global")
	h.hub.Published(token.ControlChannel, `{"revoke":"b","at":1}`)
	h.settle()
	expectFrames(t, conn, ready)
}

func TestTokensIssuedBeforeRedisConnectedAreRejected(t *testing.T) {
	h := newHarness(t)
	stale := h.registration("a", "global")
	stale.IssuedAt = connectedAt.Add(-time.Second)
	if _, err := h.hub.Open(stale); !errors.Is(err, ErrRejected) {
		t.Fatalf("got %v, want ErrRejected", err)
	}
}

func TestARedisDisconnectClosesEverythingAndRefusesUntilReconnected(t *testing.T) {
	h := newHarness(t)
	conn := h.open("a", "game-1")
	h.hub.Subscribed("game-1")
	h.hub.RedisDisconnected()
	h.settle()
	if !isClosed(conn) {
		t.Fatal("connection survived a redis disconnect")
	}
	if stats := h.hub.Stats(); stats.Connections != 0 || stats.Topics != 0 || stats.RedisConnected {
		t.Fatalf("unexpected stats %+v", stats)
	}
	if _, err := h.hub.Open(h.registration("a", "game-1")); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("got %v, want ErrUnavailable", err)
	}

	reconnectedAt := connectedAt.Add(10 * time.Second)
	h.hub.RedisConnected(reconnectedAt)
	if _, err := h.hub.Open(h.registration("a", "game-1")); !errors.Is(err, ErrRejected) {
		t.Fatalf("token issued before the reconnect: got %v, want ErrRejected", err)
	}
	fresh := h.registration("a", "game-1")
	fresh.IssuedAt = reconnectedAt
	if _, err := h.hub.Open(fresh); err != nil {
		t.Fatal(err)
	}
	h.expectRequests("subscribe game-1", "subscribe game-1")
}

func TestNonJSONPayloadsAreNotForwarded(t *testing.T) {
	h := newHarness(t)
	conn := h.open("a", "global")
	h.hub.Subscribed("global")
	h.hub.Published("global", "not json")
	h.hub.Published("global", "{\n  \"pretty\": true\n}")
	h.settle()
	got := frames(conn)
	if len(got) != 2 || got[0] != ready || strings.Count(got[1], "\n") != 2 {
		t.Fatalf("frames %q", got)
	}
}
