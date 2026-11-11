package main

import (
	"bufio"
	"context"
	"encoding/base64"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
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
	dial := flag.String("dial", "", "connect to this address instead of the relay URL's host")
	stats := flag.String("stats", "", "relay stats URL to report before and after")
	processes := flag.String("processes", "", "comma-separated process names whose memory to report")
	flag.Parse()

	kid, key := signingKey(os.Getenv("REALTIME_SIGNING_KEY"))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	report("before", *stats, *processes)

	var ready, received atomic.Int64
	var opened sync.WaitGroup
	start := time.Now()
	for i := range *connections {
		opened.Add(1)
		go func() {
			raw := sign(kid, key, i, *games)
			stream(ctx, newClient(*dial), *relay, raw, &opened, &ready, &received)
		}()
	}
	opened.Wait()
	log.Printf("%d of %d streams ready in %s", ready.Load(), *connections, time.Since(start).Round(time.Millisecond))

	publisher := redis.NewClient(&redis.Options{
		Addr:     *redisAddr,
		Username: os.Getenv("REDIS_USERNAME"),
		Password: os.Getenv("REDIS_PASSWORD"),
		Protocol: 2,
	})
	start = time.Now()
	for n := range *messages {
		if err := publisher.Publish(ctx, sharedTopic, fmt.Sprintf(`{"loadtest":%d}`, n)).Err(); err != nil {
			log.Fatal(err)
		}
	}
	want := ready.Load() * int64(*messages)
	for received.Load() < want && time.Since(start) < 30*time.Second {
		time.Sleep(10 * time.Millisecond)
	}
	log.Printf("delivered %d of %d messages in %s", received.Load(), want, time.Since(start).Round(time.Millisecond))
	report("holding", *stats, *processes)
	time.Sleep(*hold)
}

const sharedTopic = "loadtest"

func newClient(dial string) *http.Client {
	transport := &http.Transport{ForceAttemptHTTP2: true}
	if dial != "" {
		dialer := &net.Dialer{}
		transport.DialContext = func(ctx context.Context, network, _ string) (net.Conn, error) {
			return dialer.DialContext(ctx, network, dial)
		}
	}
	return &http.Client{Transport: transport}
}

func report(label, stats, processes string) {
	log.Printf("%s: available memory %s", label, statusField("/proc/meminfo", "MemAvailable"))
	log.Printf("%s: loadtest rss %s", label, statusField("/proc/self/status", "VmRSS"))
	for name := range strings.SplitSeq(processes, ",") {
		if name != "" {
			log.Printf("%s: %s rss %s", label, name, processRSS(name))
		}
	}
	if stats == "" {
		return
	}
	response, err := http.Get(stats)
	if err != nil {
		log.Printf("%s: relay stats: %v", label, err)
		return
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	log.Printf("%s: relay stats %s", label, strings.TrimSpace(string(body)))
}

func processRSS(name string) string {
	comms, _ := filepath.Glob("/proc/[0-9]*/comm")
	var found []string
	for _, comm := range comms {
		content, err := os.ReadFile(comm)
		if err != nil || strings.TrimSpace(string(content)) != name {
			continue
		}
		found = append(found, statusField(filepath.Join(filepath.Dir(comm), "status"), "VmRSS"))
	}
	if len(found) == 0 {
		return "not running"
	}
	return strings.Join(found, ", ")
}

func statusField(path, field string) string {
	content, err := os.ReadFile(path)
	if err != nil {
		return "unknown"
	}
	for line := range strings.SplitSeq(string(content), "\n") {
		if value, found := strings.CutPrefix(line, field+":"); found {
			return strings.TrimSpace(value)
		}
	}
	return "unknown"
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
		case strings.HasPrefix(line, "data: {\"topic\":\""+sharedTopic+"\""):
			received.Add(1)
		}
	}
}

func sign(kid string, key []byte, i, games int) string {
	now := time.Now()
	account := fmt.Sprintf("loadtest-%d", i)
	unsigned := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":    account,
		"topics": []string{"user-" + account, sharedTopic, fmt.Sprintf("game-loadtest-%d", i%games)},
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
