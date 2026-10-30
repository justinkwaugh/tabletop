package hub

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"tabletop/realtime/internal/token"
)

// A bounded grant: the stats Topic, which the backend grants only for the life of the
// Administrator's Admin Mode.
func (h *harness) bounded(account string, end time.Time, topics ...string) token.Registration {
	registration := h.registration(account, topics...)
	registration.Until = map[string]time.Time{token.StatsTopic: end}
	return registration
}

func (h *harness) openBounded(account string, end time.Time, topics ...string) *Conn {
	h.t.Helper()
	conn, err := h.hub.Open(h.bounded(account, end, topics...))
	if err != nil {
		h.t.Fatal(err)
	}
	return conn
}

func TestAGrantThatHasEndedIsNotJoined(t *testing.T) {
	h := newHarness(t)
	admin := h.openBounded("a", connectedAt, "global", "relay-stats")
	h.hub.Subscribed("global")
	h.expectRequests("subscribe global")
	expectFrames(t, admin, firstReady(admin, "global"))
	h.open("b", "global")
	h.broadcastStats()
	expectFrames(t, admin)
}

func TestAGrantEndsOnTimeWhateverTheConnectionDoes(t *testing.T) {
	h := newHarness(t)
	end := connectedAt.Add(10 * time.Minute)
	admin := h.openBounded("a", end, "global", "relay-stats")
	h.hub.Subscribed("global")
	h.settle()
	expectFrames(t, admin, firstReady(admin, "global", "relay-stats"), statsFrame(1, 1, 1))

	h.advance(10*time.Minute - time.Second)
	h.open("b", "global")
	h.broadcastStats()
	expectFrames(t, admin, statsFrame(2, 2, 2))

	h.advance(time.Second)
	h.open("c", "global")
	h.broadcastStats()
	expectFrames(t, admin, readyFor("global"))
	if isClosed(admin) {
		t.Fatal("the connection must keep its ordinary Topics")
	}

	h.hub.Published("global", `{"n":1}`)
	h.settle()
	expectFrames(t, admin, message("global", `{"n":1}`))
	h.hub.Close(h.open("d", "global"))
	h.broadcastStats()
	expectFrames(t, admin)
}

func TestTheSweepRetiresAnEndedGrantOnAnIdleConnection(t *testing.T) {
	h := newHarness(t)
	admin := h.openBounded("a", connectedAt.Add(time.Minute), "relay-stats")
	frames(admin)
	h.advance(time.Minute)
	h.sweep()
	expectFrames(t, admin, "event: ready\ndata: {\"topics\":[]}\n\n")
	h.open("b", "global")
	h.broadcastStats()
	expectFrames(t, admin)
}

func TestAnOrdinaryMessageIsNotDeliveredOnAnEndedGrant(t *testing.T) {
	h := newHarness(t)
	conn, err := h.hub.Open(token.Registration{
		Account:   "a",
		Topics:    []string{"game-g1", "global"},
		Until:     map[string]time.Time{"game-g1": connectedAt.Add(time.Minute)},
		IssuedAt:  issuedAt,
		ExpiresAt: issuedAt.Add(time.Minute),
		ID:        "bounded-game",
	})
	if err != nil {
		t.Fatal(err)
	}
	h.hub.Subscribed("game-g1")
	h.hub.Subscribed("global")
	h.expectRequests("subscribe game-g1", "subscribe global")
	frames(conn)
	h.advance(time.Minute)
	h.hub.Published("game-g1", `{"n":1}`)
	h.hub.Published("global", `{"n":2}`)
	h.settle()
	expectFrames(t, conn, readyFor("global"), message("global", `{"n":2}`))
	h.expectRequests("unsubscribe game-g1")
}

func TestAGrantThatEndsWhileATopicChangeIsPendingIsLeftOutOfTheReady(t *testing.T) {
	h := newHarness(t)
	admin := h.openBounded("a", connectedAt.Add(time.Minute), "relay-stats")
	frames(admin)
	if err := h.hub.ChangeTopics(admin.id, h.bounded("a", connectedAt.Add(time.Minute), "global", "relay-stats")); err != nil {
		t.Fatal(err)
	}
	h.advance(time.Minute)
	h.hub.Subscribed("global")
	h.settle()
	expectFrames(t, admin, readyFor("global"))
}

func TestATopicChangeCanRenewAGrantBeforeItEnds(t *testing.T) {
	h := newHarness(t)
	admin := h.openBounded("a", connectedAt.Add(time.Minute), "relay-stats")
	frames(admin)
	renewed := h.bounded("a", connectedAt.Add(3*time.Minute), "relay-stats")
	if err := h.hub.ChangeTopics(admin.id, renewed); err != nil {
		t.Fatal(err)
	}
	frames(admin)
	h.advance(2 * time.Minute)
	h.open("b", "global")
	h.broadcastStats()
	expectFrames(t, admin, statsFrame(2, 2, 2))
}

func TestATopicRevocationEndsTheGrantButKeepsTheConnection(t *testing.T) {
	h := newHarness(t)
	end := connectedAt.Add(10 * time.Minute)
	admin := h.openBounded("a", end, "global", "relay-stats")
	other := h.openBounded("b", end, "relay-stats")
	h.hub.Subscribed("global")
	h.settle()
	frames(admin)
	frames(other)
	earlier := h.bounded("a", end, "relay-stats")
	ordinary := h.registration("a", "global")

	h.hub.Published(token.ControlChannel,
		fmt.Sprintf(`{"revoke":"a","topics":["relay-stats"],"at":%d.5}`, issuedAt.Unix()))
	h.settle()
	expectFrames(t, admin, readyFor("global"))
	if isClosed(admin) || isClosed(other) {
		t.Fatal("a topic revocation closes nothing")
	}
	h.open("c", "global")
	h.broadcastStats()
	expectFrames(t, admin)
	expectFrames(t, other, statsFrame(3, 3, 3))

	if _, err := h.hub.Open(earlier); !errors.Is(err, ErrRejected) {
		t.Fatalf("a token granting the revoked topic from before the revocation: got %v, want ErrRejected", err)
	}
	if _, err := h.hub.Open(ordinary); err != nil {
		t.Fatalf("the account's ordinary token from before the revocation refused: %v", err)
	}
	later := h.bounded("a", end, "relay-stats")
	later.IssuedAt = issuedAt.Add(time.Second)
	if _, err := h.hub.Open(later); err != nil {
		t.Fatalf("a token issued after the revocation refused: %v", err)
	}
}

func TestATopicRevocationIsForgottenWithAnAccountRevocation(t *testing.T) {
	h := newHarness(t)
	h.hub.Published(token.ControlChannel, fmt.Sprintf(`{"revoke":"a","topics":["relay-stats"],"at":%d}`, issuedAt.Unix()))
	h.settle()
	h.advance(2 * time.Minute)
	h.sweep()
	if _, err := h.hub.Open(h.bounded("a", connectedAt.Add(5*time.Minute), "relay-stats")); err != nil {
		t.Fatalf("token refused after the revocation memory: %v", err)
	}
}
