package hub

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"time"

	"tabletop/realtime/internal/token"
)

var (
	ErrUnavailable = errors.New("relay is not connected to redis")
	ErrAtCapacity  = errors.New("relay is at capacity")
	ErrRejected    = errors.New("token rejected")
)

type Subscriptions interface {
	Subscribe(topic string) error
	Unsubscribe(topic string) error
}

type Config struct {
	MaxConnections           int
	MaxConnectionsPerAccount int
	ConnectionBuffer         int
	RevocationMemory         time.Duration
	SweepInterval            time.Duration
	Now                      func() time.Time
}

type Stats struct {
	RedisConnected bool `json:"redisConnected"`
	Connections    int  `json:"connections"`
	Accounts       int  `json:"accounts"`
	Topics         int  `json:"topics"`
}

type Hub struct {
	config        Config
	subscriptions Subscriptions
	requests      chan func()
	stopped       chan struct{}

	redisConnected   bool
	redisConnectedAt time.Time
	topics           map[string]*topicState
	accounts         map[string][]*Conn
	connections      int
	usedTokens       map[string]time.Time
	revocations      map[string]time.Time
}

func New(config Config, subscriptions Subscriptions) *Hub {
	return &Hub{
		config:        config,
		subscriptions: subscriptions,
		requests:      make(chan func(), 1024),
		stopped:       make(chan struct{}),
		topics:        map[string]*topicState{},
		accounts:      map[string][]*Conn{},
		usedTokens:    map[string]time.Time{},
		revocations:   map[string]time.Time{},
	}
}

func (h *Hub) Run(ctx context.Context) {
	sweep := time.NewTicker(h.config.SweepInterval)
	defer sweep.Stop()
	defer close(h.stopped)
	for {
		select {
		case request := <-h.requests:
			request()
		case <-sweep.C:
			h.sweep()
		case <-ctx.Done():
			h.dropAll()
			return
		}
	}
}

func (h *Hub) Open(registration token.Registration) (*Conn, error) {
	var conn *Conn
	err := ErrUnavailable
	h.await(func() { conn, err = h.open(registration) })
	return conn, err
}

func (h *Hub) Close(conn *Conn) {
	h.await(func() { h.drop(conn) })
}

func (h *Hub) Stats() Stats {
	var stats Stats
	h.await(func() {
		stats = Stats{
			RedisConnected: h.redisConnected,
			Connections:    h.connections,
			Accounts:       len(h.accounts),
			Topics:         len(h.topics),
		}
	})
	return stats
}

func (h *Hub) RedisConnected(at time.Time) {
	h.post(func() {
		h.redisConnected = true
		h.redisConnectedAt = at
	})
}

func (h *Hub) RedisDisconnected() {
	h.post(func() {
		h.redisConnected = false
		h.dropAll()
	})
}

func (h *Hub) Subscribed(topic string) {
	h.post(func() { h.acknowledged(topic, subscribed) })
}

func (h *Hub) Unsubscribed(topic string) {
	h.post(func() { h.acknowledged(topic, unsubscribed) })
}

func (h *Hub) Published(topic, payload string) {
	h.post(func() { h.published(topic, payload) })
}

func (h *Hub) await(request func()) {
	done := make(chan struct{})
	h.post(func() {
		request()
		close(done)
	})
	select {
	case <-done:
	case <-h.stopped:
	}
}

func (h *Hub) post(request func()) {
	select {
	case h.requests <- request:
	case <-h.stopped:
	}
}

func (h *Hub) open(registration token.Registration) (*Conn, error) {
	if !h.redisConnected {
		return nil, ErrUnavailable
	}
	if registration.IssuedAt.Before(h.redisConnectedAt.Truncate(time.Second)) {
		return nil, fmt.Errorf("%w: issued before the redis subscriber connected", ErrRejected)
	}
	if revokedAt, revoked := h.revocations[registration.Account]; revoked && !registration.IssuedAt.After(revokedAt) {
		return nil, fmt.Errorf("%w: issued before the account was revoked", ErrRejected)
	}
	if _, used := h.usedTokens[registration.ID]; used {
		return nil, fmt.Errorf("%w: already used", ErrRejected)
	}
	if h.connections >= h.config.MaxConnections {
		return nil, ErrAtCapacity
	}
	h.usedTokens[registration.ID] = registration.ExpiresAt

	if accountConns := h.accounts[registration.Account]; len(accountConns) >= h.config.MaxConnectionsPerAccount {
		h.drop(accountConns[0])
	}

	conn := newConn(registration.Account, registration.Topics, h.config.ConnectionBuffer)
	h.accounts[conn.account] = append(h.accounts[conn.account], conn)
	h.connections++
	for _, topic := range conn.topics {
		h.join(conn, topic)
	}
	if conn.unconfirmedTopics == 0 {
		h.markReady(conn)
	}
	return conn, nil
}

func (h *Hub) join(conn *Conn, topic string) {
	state, exists := h.topics[topic]
	if !exists {
		state = newTopicState()
		h.topics[topic] = state
	}
	state.conns[conn] = struct{}{}
	if state.lastRequested != subscribed {
		h.request(topic, state, subscribed)
	}
	if !state.confirmed() {
		conn.unconfirmedTopics++
	}
}

func (h *Hub) leave(conn *Conn, topic string) {
	state := h.topics[topic]
	delete(state.conns, conn)
	if len(state.conns) == 0 && state.lastRequested == subscribed {
		h.request(topic, state, unsubscribed)
	}
}

func (h *Hub) request(topic string, state *topicState, kind subscriptionKind) {
	state.awaiting = append(state.awaiting, kind)
	state.lastRequested = kind
	var err error
	if kind == subscribed {
		err = h.subscriptions.Subscribe(topic)
	} else {
		err = h.subscriptions.Unsubscribe(topic)
	}
	if err != nil {
		slog.Warn("redis subscription request failed", "topic", topic, "kind", kind, "error", err)
	}
}

func (h *Hub) acknowledged(topic string, kind subscriptionKind) {
	state, exists := h.topics[topic]
	if !exists || len(state.awaiting) == 0 || state.awaiting[0] != kind {
		slog.Error("unexpected redis acknowledgement", "topic", topic, "kind", kind)
		return
	}
	state.awaiting = state.awaiting[1:]
	if len(state.awaiting) > 0 {
		return
	}
	if state.lastRequested == unsubscribed {
		if len(state.conns) == 0 {
			delete(h.topics, topic)
		}
		return
	}
	for conn := range state.conns {
		if conn.ready {
			continue
		}
		conn.unconfirmedTopics--
		if conn.unconfirmedTopics == 0 {
			h.markReady(conn)
		}
	}
}

func (h *Hub) markReady(conn *Conn) {
	conn.ready = true
	h.send(conn, readyFrame)
}

func (h *Hub) published(topic, payload string) {
	if topic == token.ControlChannel {
		h.control(payload)
		return
	}
	state, exists := h.topics[topic]
	if !exists {
		return
	}
	frame, err := messageFrame(topic, payload)
	if err != nil {
		slog.Error("unforwardable message", "topic", topic, "error", err)
		return
	}
	for conn := range state.conns {
		if conn.ready {
			h.send(conn, frame)
		}
	}
}

func (h *Hub) send(conn *Conn, frame []byte) {
	select {
	case conn.frames <- frame:
	default:
		slog.Info("dropping a connection that is not keeping up", "account", conn.account)
		h.drop(conn)
	}
}

func (h *Hub) control(payload string) {
	var message controlMessage
	if err := json.Unmarshal([]byte(payload), &message); err != nil || message.Revoke == "" {
		slog.Error("malformed control message", "payload", payload, "error", err)
		return
	}
	revokedAt := time.Unix(0, int64(message.At*float64(time.Second)))
	h.revocations[message.Revoke] = revokedAt
	for _, conn := range slices.Clone(h.accounts[message.Revoke]) {
		h.drop(conn)
	}
}

func (h *Hub) drop(conn *Conn) {
	if conn.dropped {
		return
	}
	conn.dropped = true
	close(conn.closed)
	h.connections--
	remaining := slices.DeleteFunc(h.accounts[conn.account], func(c *Conn) bool { return c == conn })
	if len(remaining) == 0 {
		delete(h.accounts, conn.account)
	} else {
		h.accounts[conn.account] = remaining
	}
	for _, topic := range conn.topics {
		h.leave(conn, topic)
	}
}

func (h *Hub) dropAll() {
	for _, conns := range h.accounts {
		for _, conn := range conns {
			conn.dropped = true
			close(conn.closed)
		}
	}
	h.accounts = map[string][]*Conn{}
	h.connections = 0
	h.topics = map[string]*topicState{}
}

func (h *Hub) sweep() {
	now := h.config.Now()
	for id, expiresAt := range h.usedTokens {
		if expiresAt.Before(now) {
			delete(h.usedTokens, id)
		}
	}
	for account, revokedAt := range h.revocations {
		if now.Sub(revokedAt) > h.config.RevocationMemory {
			delete(h.revocations, account)
		}
	}
}

type controlMessage struct {
	Revoke string  `json:"revoke"`
	At     float64 `json:"at"`
}

type subscriptionKind string

const (
	subscribed   subscriptionKind = "subscribe"
	unsubscribed subscriptionKind = "unsubscribe"
)

type topicState struct {
	conns         map[*Conn]struct{}
	awaiting      []subscriptionKind
	lastRequested subscriptionKind
}

func newTopicState() *topicState {
	return &topicState{conns: map[*Conn]struct{}{}, lastRequested: unsubscribed}
}

func (t *topicState) confirmed() bool {
	return len(t.awaiting) == 0 && t.lastRequested == subscribed
}

var readyFrame = []byte("event: ready\ndata: {}\n\n")

func messageFrame(topic, payload string) ([]byte, error) {
	if !json.Valid([]byte(payload)) {
		return nil, errors.New("payload is not JSON")
	}
	body, err := json.Marshal(struct {
		Topic   string          `json:"topic"`
		Message json.RawMessage `json:"message"`
	}{topic, json.RawMessage(payload)})
	if err != nil {
		return nil, err
	}
	frame := append([]byte("data: "), body...)
	return append(frame, '\n', '\n'), nil
}
