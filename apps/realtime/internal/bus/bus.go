package bus

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"tabletop/realtime/internal/token"
)

type Listener interface {
	RedisConnected(at time.Time)
	RedisDisconnected()
	Subscribed(topic string)
	Unsubscribed(topic string)
	Published(topic, payload string)
}

type Config struct {
	Options        *redis.Options
	PingInterval   time.Duration
	ReceiveTimeout time.Duration
	CommandTimeout time.Duration
	MinBackoff     time.Duration
	MaxBackoff     time.Duration
	Now            func() time.Time
}

type Bus struct {
	config   Config
	client   *redis.Client
	listener Listener
	commands chan command

	mu         sync.Mutex
	pubsub     *redis.PubSub
	generation uint64
}

type command struct {
	generation uint64
	send       func(context.Context, *redis.PubSub) error
}

const commandQueueSize = 4096

var (
	errNotConnected = errors.New("redis subscriber is not connected")
	errQueueFull    = errors.New("redis command queue is full")
)

func New(config Config) *Bus {
	return &Bus{
		config:   config,
		client:   redis.NewClient(config.Options),
		commands: make(chan command, commandQueueSize),
	}
}

func (b *Bus) SetListener(listener Listener) {
	b.listener = listener
}

func (b *Bus) Subscribe(topic string) error {
	return b.enqueue(func(ctx context.Context, pubsub *redis.PubSub) error {
		return pubsub.Subscribe(ctx, topic)
	})
}

func (b *Bus) Unsubscribe(topic string) error {
	return b.enqueue(func(ctx context.Context, pubsub *redis.PubSub) error {
		return pubsub.Unsubscribe(ctx, topic)
	})
}

func (b *Bus) Run(ctx context.Context) {
	go b.executeCommands(ctx)
	backoff := b.config.MinBackoff
	for ctx.Err() == nil {
		connected := b.session(ctx)
		if connected {
			backoff = b.config.MinBackoff
			b.listener.RedisDisconnected()
		}
		select {
		case <-ctx.Done():
		case <-time.After(backoff):
		}
		backoff = min(backoff*2, b.config.MaxBackoff)
	}
	_ = b.client.Close()
}

func (b *Bus) session(ctx context.Context) bool {
	pubsub := b.client.Subscribe(ctx, token.ControlChannel)
	b.setPubSub(pubsub)
	defer func() {
		b.setPubSub(nil)
		_ = pubsub.Close()
	}()

	sessionCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	go b.ping(sessionCtx, pubsub)

	connected := false
	for {
		received, err := pubsub.ReceiveTimeout(sessionCtx, b.config.ReceiveTimeout)
		if err != nil {
			if ctx.Err() == nil {
				slog.Warn("redis subscriber lost", "error", err)
			}
			return connected
		}
		switch message := received.(type) {
		case *redis.Subscription:
			if message.Channel == token.ControlChannel {
				if message.Kind == "subscribe" && !connected {
					connected = true
					slog.Info("redis subscriber connected")
					b.listener.RedisConnected(b.config.Now())
				}
				continue
			}
			switch message.Kind {
			case "subscribe":
				b.listener.Subscribed(message.Channel)
			case "unsubscribe":
				b.listener.Unsubscribed(message.Channel)
			}
		case *redis.Message:
			b.listener.Published(message.Channel, message.Payload)
		case *redis.Pong:
		default:
			slog.Warn("unexpected redis reply", "reply", fmt.Sprintf("%T", received))
		}
	}
}

func (b *Bus) ping(ctx context.Context, pubsub *redis.PubSub) {
	ticker := time.NewTicker(b.config.PingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := pubsub.Ping(ctx); err != nil {
				slog.Warn("redis ping failed", "error", err)
				_ = pubsub.Close()
				return
			}
		}
	}
}

func (b *Bus) enqueue(send func(context.Context, *redis.PubSub) error) error {
	pubsub, generation := b.current()
	if pubsub == nil {
		return errNotConnected
	}
	select {
	case b.commands <- command{generation: generation, send: send}:
		return nil
	default:
		go pubsub.Close()
		return errQueueFull
	}
}

func (b *Bus) executeCommands(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case next := <-b.commands:
			b.execute(next)
		}
	}
}

func (b *Bus) execute(next command) {
	pubsub, generation := b.current()
	if pubsub == nil || generation != next.generation {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), b.config.CommandTimeout)
	defer cancel()
	if err := next.send(ctx, pubsub); err != nil {
		slog.Warn("redis subscription command failed", "error", err)
		_ = pubsub.Close()
	}
}

func (b *Bus) current() (*redis.PubSub, uint64) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.pubsub, b.generation
}

func (b *Bus) setPubSub(pubsub *redis.PubSub) {
	b.mu.Lock()
	b.pubsub = pubsub
	b.generation++
	b.mu.Unlock()
}
