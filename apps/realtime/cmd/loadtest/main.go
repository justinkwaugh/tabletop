package main

import (
	"bufio"
	"context"
	"encoding/base64"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"

	"tabletop/realtime/internal/token"
)

func main() {
	relay := flag.String("relay", "http://127.0.0.1:8090", "relay base URL")
	redisAddr := flag.String("redis", "localhost:6379", "redis address to publish on")
	connections := flag.Int("connections", 1000, "streams to open")
	games := flag.Int("games", 100, "distinct game topics spread across the streams")
	messages := flag.Int("messages", 20, "messages to publish on the global topic")
	hold := flag.Duration("hold", 0, "keep the streams open this long before closing them")
	flag.Parse()

	kid, key := signingKey(os.Getenv("REALTIME_SIGNING_KEY"))
	client := &http.Client{Transport: &http.Transport{MaxConnsPerHost: 0, MaxIdleConnsPerHost: *connections}}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var ready, received atomic.Int64
	var opened sync.WaitGroup
	start := time.Now()
	for i := range *connections {
		opened.Add(1)
		go func() {
			raw := sign(kid, key, i, *games)
			stream(ctx, client, *relay, raw, &opened, &ready, &received)
		}()
	}
	opened.Wait()
	log.Printf("%d of %d streams ready in %s", ready.Load(), *connections, time.Since(start).Round(time.Millisecond))

	publisher := redis.NewClient(&redis.Options{Addr: *redisAddr, Protocol: 2})
	start = time.Now()
	for n := range *messages {
		if err := publisher.Publish(ctx, "global", fmt.Sprintf(`{"loadtest":%d}`, n)).Err(); err != nil {
			log.Fatal(err)
		}
	}
	want := ready.Load() * int64(*messages)
	for received.Load() < want && time.Since(start) < 30*time.Second {
		time.Sleep(10 * time.Millisecond)
	}
	log.Printf("delivered %d of %d messages in %s", received.Load(), want, time.Since(start).Round(time.Millisecond))
	time.Sleep(*hold)
}

func stream(ctx context.Context, client *http.Client, relay, raw string, opened *sync.WaitGroup, ready, received *atomic.Int64) {
	signalled := false
	defer func() {
		if !signalled {
			opened.Done()
		}
	}()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, relay+"/stream?t="+raw, nil)
	if err != nil {
		return
	}
	response, err := client.Do(request)
	if err != nil {
		log.Printf("open: %v", err)
		return
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		log.Printf("open: status %d", response.StatusCode)
		return
	}
	lines := bufio.NewScanner(response.Body)
	for lines.Scan() {
		line := lines.Text()
		switch {
		case line == "event: ready":
			ready.Add(1)
			signalled = true
			opened.Done()
		case strings.HasPrefix(line, "data: {\"topic\":\"global\""):
			received.Add(1)
		}
	}
}

func sign(kid string, key []byte, i, games int) string {
	now := time.Now()
	account := fmt.Sprintf("loadtest-%d", i)
	unsigned := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":    account,
		"topics": []string{"user-" + account, "global", fmt.Sprintf("game-loadtest-%d", i%games)},
		"aud":    token.Audience,
		"iat":    now.Unix(),
		"exp":    now.Add(token.MaxLifetime).Unix(),
		"jti":    fmt.Sprintf("%s-%d", account, now.UnixNano()),
	})
	unsigned.Header["kid"] = kid
	raw, err := unsigned.SignedString(key)
	if err != nil {
		log.Fatal(err)
	}
	return raw
}

func signingKey(raw string) (string, []byte) {
	kid, encoded, found := strings.Cut(raw, ":")
	key, err := base64.RawURLEncoding.DecodeString(encoded)
	if !found || err != nil {
		log.Fatal("REALTIME_SIGNING_KEY must be kid:base64url")
	}
	return kid, key
}
