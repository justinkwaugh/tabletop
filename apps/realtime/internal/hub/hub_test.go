package hub

import (
	"context"
	"encoding/json"
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
var issuedAt = connectedAt.Add(time.Second)

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
		IssuedAt:  issuedAt,
		ExpiresAt: issuedAt.Add(time.Minute),
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

func (h *harness) change(conn *Conn, topics ...string) {
	h.t.Helper()
	if err := h.hub.ChangeTopics(conn.id, h.registration(conn.account, topics...)); err != nil {
		h.t.Fatal(err)
	}
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
		t.Fatalf("frames %q\nwant   %q", got, want)
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

func readyFor(topics ...string) string {
	body, _ := json.Marshal(readyEvent{Topics: topics})
	return "event: ready\ndata: " + string(body) + "\n\n"
}

func firstReady(conn *Conn, topics ...string) string {
	body, _ := json.Marshal(readyEvent{Connection: conn.id, Topics: topics})
	return "event: ready\ndata: " + string(body) + "\n\n"
}

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
	expectFrames(t, conn, firstReady(conn, "game-1", "global"))
}

func TestMessagesBeforeReadyAreDropped(t *testing.T) {
	h := newHarness(t)
	conn := h.open("a", "game-1", "global")
	h.hub.Subscribed("game-1")
	h.hub.Published("game-1", `{"early":true}`)
	h.hub.Subscribed("global")
	h.hub.Published("game-1", `{"late":true}`)
	h.settle()
	expectFrames(t, conn, firstReady(conn, "game-1", "global"), message("game-1", `{"late":true}`))
}

func TestASharedTopicIsSubscribedOnceAndFannedOut(t *testing.T) {
	h := newHarness(t)
	first := h.open("a", "game-1")
	second := h.open("b", "game-1")
	h.expectRequests("subscribe game-1")

	h.hub.Subscribed("game-1")
	h.hub.Published("game-1", `{"n":1}`)
	h.settle()
	expectFrames(t, first, firstReady(first, "game-1"), message("game-1", `{"n":1}`))
	expectFrames(t, second, firstReady(second, "game-1"), message("game-1", `{"n":1}`))
}

func TestAConfirmedTopicMakesANewConnectionReadyAtOnce(t *testing.T) {
	h := newHarness(t)
	h.open("a", "game-1")
	h.hub.Subscribed("game-1")
	second := h.open("b", "game-1")
	h.expectRequests("subscribe game-1")
	expectFrames(t, second, firstReady(second, "game-1"))
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
	expectFrames(t, second, firstReady(second, "game-1"))
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

func TestAddingATopicKeepsTheOthersFlowing(t *testing.T) {
	h := newHarness(t)
	conn := h.open("a", "global", "user-a")
	h.hub.Subscribed("global")
	h.hub.Subscribed("user-a")
	h.settle()
	frames(conn)

	h.change(conn, "game-1", "global", "user-a")
	h.hub.Published("user-a", `{"n":1}`)
	h.hub.Published("game-1", `{"early":true}`)
	h.hub.Subscribed("game-1")
	h.hub.Published("game-1", `{"late":true}`)
	h.hub.Published("user-a", `{"n":2}`)
	h.settle()
	expectFrames(t, conn,
		message("user-a", `{"n":1}`),
		readyFor("game-1", "global", "user-a"),
		message("game-1", `{"late":true}`),
		message("user-a", `{"n":2}`),
	)
}

func TestRemovingATopicStopsItAndAnnouncesTheChange(t *testing.T) {
	h := newHarness(t)
	conn := h.open("a", "game-1", "global")
	h.hub.Subscribed("game-1")
	h.hub.Subscribed("global")
	h.settle()
	frames(conn)
	h.subscriptions.taken()

	h.change(conn, "global")
	h.hub.Published("game-1", `{"n":1}`)
	h.hub.Published("global", `{"n":2}`)
	h.expectRequests("unsubscribe game-1")
	expectFrames(t, conn,
		readyFor("global"),
		message("global", `{"n":2}`),
	)
}

func TestAChangeDuringAnUnfinishedChangeWaitsForBoth(t *testing.T) {
	h := newHarness(t)
	conn := h.open("a", "global")
	h.hub.Subscribed("global")
	h.settle()
	frames(conn)

	h.change(conn, "game-1", "global")
	h.change(conn, "game-1", "game-2", "global")
	h.hub.Subscribed("game-1")
	h.settle()
	expectFrames(t, conn)
	h.hub.Subscribed("game-2")
	h.settle()
	expectFrames(t, conn, readyFor("game-1", "game-2", "global"))
}

func TestTopicChangesAreCheckedLikeNewStreams(t *testing.T) {
	h := newHarness(t)
	conn := h.open("a", "global")
	if err := h.hub.ChangeTopics("missing", h.registration("a", "global")); !errors.Is(err, ErrUnknownConnection) {
		t.Fatalf("unknown connection: got %v", err)
	}
	if err := h.hub.ChangeTopics(conn.id, h.registration("b", "global")); !errors.Is(err, ErrRejected) {
		t.Fatalf("another account: got %v", err)
	}
	reused := h.registration("a", "global")
	if err := h.hub.ChangeTopics(conn.id, reused); err != nil {
		t.Fatal(err)
	}
	if err := h.hub.ChangeTopics(conn.id, reused); !errors.Is(err, ErrRejected) {
		t.Fatalf("reused token: got %v", err)
	}
	h.hub.Published(token.ControlChannel, fmt.Sprintf(`{"revoke":"a","at":%d}`, issuedAt.Unix()))
	h.settle()
	if !isClosed(conn) {
		t.Fatal("revoked connection still open")
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

func TestUsedTokensAreRememberedUntilTheVerifierStopsAcceptingThem(t *testing.T) {
	now := connectedAt
	h := newHarness(t, func(c *Config) { c.Now = func() time.Time { return now } })
	registration := h.registration("a", "global")
	if _, err := h.hub.Open(registration); err != nil {
		t.Fatal(err)
	}

	now = registration.ExpiresAt.Add(token.ClockLeeway - time.Millisecond)
	h.hub.await(h.hub.sweep)
	if _, err := h.hub.Open(registration); !errors.Is(err, ErrRejected) {
		t.Fatalf("replay inside the clock leeway: got %v, want ErrRejected", err)
	}

	now = registration.ExpiresAt.Add(token.ClockLeeway + time.Second)
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

	h.hub.Published(token.ControlChannel, fmt.Sprintf(`{"revoke":"a","at":%d.5}`, issuedAt.Unix()))
	h.settle()
	if !isClosed(revoked) || isClosed(kept) {
		t.Fatal("expected only account a's connection to close")
	}
	if _, err := h.hub.Open(older); !errors.Is(err, ErrRejected) {
		t.Fatalf("got %v, want ErrRejected", err)
	}

	newer := h.registration("a", "global")
	newer.IssuedAt = issuedAt.Add(time.Second)
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
	expectFrames(t, conn, firstReady(conn, "global"))
}

func TestTokensIssuedUpToTheRedisConnectSecondAreRejected(t *testing.T) {
	h := newHarness(t)
	for _, offset := range []time.Duration{-time.Second, 0} {
		stale := h.registration("a", "global")
		stale.IssuedAt = connectedAt.Add(offset)
		if _, err := h.hub.Open(stale); !errors.Is(err, ErrRejected) {
			t.Fatalf("issued at connect%+v: got %v, want ErrRejected", offset, err)
		}
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

	reconnectedAt := connectedAt.Add(10*time.Second + 900*time.Millisecond)
	h.hub.RedisConnected(reconnectedAt)
	sameSecond := h.registration("a", "game-1")
	sameSecond.IssuedAt = reconnectedAt.Truncate(time.Second)
	if _, err := h.hub.Open(sameSecond); !errors.Is(err, ErrRejected) {
		t.Fatalf("token issued in the reconnect second: got %v, want ErrRejected", err)
	}
	fresh := h.registration("a", "game-1")
	fresh.IssuedAt = reconnectedAt.Truncate(time.Second).Add(time.Second)
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
	if len(got) != 2 || got[0] != firstReady(conn, "global") || strings.Count(got[1], "\n") != 2 {
		t.Fatalf("frames %q", got)
	}
}

func TestARevocationWithoutATimeRevokesAsOfItsArrival(t *testing.T) {
	arrival := issuedAt.Add(2 * time.Second)
	h := newHarness(t, func(c *Config) { c.Now = func() time.Time { return arrival } })
	conn := h.open("a", "global")
	beforeArrival := h.registration("a", "global")
	beforeArrival.IssuedAt = arrival.Add(-time.Second)

	h.hub.Published(token.ControlChannel, `{"revoke":"a"}`)
	h.settle()
	if !isClosed(conn) {
		t.Fatal("revoked connection still open")
	}
	if _, err := h.hub.Open(beforeArrival); !errors.Is(err, ErrRejected) {
		t.Fatalf("token issued before the revocation arrived: got %v, want ErrRejected", err)
	}
}
