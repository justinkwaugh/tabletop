package bus

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"tabletop/realtime/internal/token"
)

type recorder struct {
	events chan string
}

func (r recorder) RedisConnected(time.Time)  { r.events <- "connected" }
func (r recorder) RedisDisconnected()        { r.events <- "disconnected" }
func (r recorder) Subscribed(topic string)   { r.events <- "subscribed " + topic }
func (r recorder) Unsubscribed(topic string) { r.events <- "unsubscribed " + topic }
func (r recorder) Published(topic, p string) { r.events <- "published " + topic + " " + p }

func (r recorder) expect(t *testing.T, want string) {
	t.Helper()
	select {
	case got := <-r.events:
		if got != want {
			t.Fatalf("event %q, want %q", got, want)
		}
	case <-time.After(5 * time.Second):
		t.Fatalf("timed out waiting for %q", want)
	}
}

func TestBusAgainstRedis(t *testing.T) {
	addr := os.Getenv("REALTIME_TEST_REDIS_ADDR")
	if addr == "" {
		t.Skip("set REALTIME_TEST_REDIS_ADDR to run against Redis")
	}
	clientName := fmt.Sprintf("realtime-bus-test-%d", time.Now().UnixNano())
	topic := clientName + "-topic"

	events := recorder{events: make(chan string, 16)}
	b := New(Config{
		Options:        &redis.Options{Addr: addr, Protocol: 2, ClientName: clientName},
		PingInterval:   time.Second,
		ReceiveTimeout: 3 * time.Second,
		CommandTimeout: time.Second,
		MinBackoff:     50 * time.Millisecond,
		MaxBackoff:     time.Second,
		Now:            time.Now,
	})
	b.SetListener(events)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go b.Run(ctx)

	publisher := redis.NewClient(&redis.Options{Addr: addr, Protocol: 2})
	defer publisher.Close()

	events.expect(t, "connected")
	if err := b.Subscribe(topic); err != nil {
		t.Fatal(err)
	}
	events.expect(t, "subscribed "+topic)

	if err := publisher.Publish(ctx, topic, `{"n":1}`).Err(); err != nil {
		t.Fatal(err)
	}
	events.expect(t, "published "+topic+` {"n":1}`)

	if err := publisher.Publish(ctx, token.ControlChannel, `{"revoke":"nobody","at":1}`).Err(); err != nil {
		t.Fatal(err)
	}
	events.expect(t, "published "+token.ControlChannel+` {"revoke":"nobody","at":1}`)

	if err := b.Unsubscribe(topic); err != nil {
		t.Fatal(err)
	}
	events.expect(t, "unsubscribed "+topic)

	killClient(t, ctx, publisher, clientName)
	events.expect(t, "disconnected")
	events.expect(t, "connected")
}

func killClient(t *testing.T, ctx context.Context, admin *redis.Client, name string) {
	t.Helper()
	clients, err := admin.ClientList(ctx).Result()
	if err != nil {
		t.Fatal(err)
	}
	for line := range strings.SplitSeq(clients, "\n") {
		if !strings.Contains(line, " name="+name+" ") {
			continue
		}
		for field := range strings.FieldsSeq(line) {
			if id, found := strings.CutPrefix(field, "id="); found {
				if err := admin.Do(ctx, "CLIENT", "KILL", "ID", id).Err(); err != nil {
					t.Fatal(err)
				}
				return
			}
		}
	}
	t.Fatalf("no redis client named %s", name)
}
