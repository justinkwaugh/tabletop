package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Listen                   string
	StatsListen              string
	RedisAddr                string
	RedisUsername            string
	RedisPassword            string
	SigningKeys              map[string][]byte
	AllowedOrigins           []string
	MaxConnections           int
	MaxConnectionsPerAccount int
}

func FromEnv() (Config, error) {
	signingKeys, err := parseSigningKeys(os.Getenv("REALTIME_SIGNING_KEYS"))
	if err != nil {
		return Config{}, err
	}
	allowedOrigins := splitList(os.Getenv("REALTIME_ALLOWED_ORIGINS"))
	if len(allowedOrigins) == 0 {
		return Config{}, errors.New("REALTIME_ALLOWED_ORIGINS is required")
	}
	maxConnections, err := intOr("REALTIME_MAX_CONNECTIONS", 5000)
	if err != nil {
		return Config{}, err
	}
	maxConnectionsPerAccount, err := intOr("REALTIME_MAX_CONNECTIONS_PER_ACCOUNT", 50)
	if err != nil {
		return Config{}, err
	}
	return Config{
		Listen:                   stringOr("REALTIME_LISTEN", "127.0.0.1:8090"),
		StatsListen:              stringOr("REALTIME_STATS_LISTEN", "127.0.0.1:8091"),
		RedisAddr:                net.JoinHostPort(stringOr("REDIS_HOST", "localhost"), stringOr("REDIS_PORT", "6379")),
		RedisUsername:            os.Getenv("REDIS_USERNAME"),
		RedisPassword:            os.Getenv("REDIS_PASSWORD"),
		SigningKeys:              signingKeys,
		AllowedOrigins:           allowedOrigins,
		MaxConnections:           maxConnections,
		MaxConnectionsPerAccount: maxConnectionsPerAccount,
	}, nil
}

func parseSigningKeys(raw string) (map[string][]byte, error) {
	entries := splitList(raw)
	if len(entries) == 0 {
		return nil, errors.New("REALTIME_SIGNING_KEYS is required, as kid:base64url-key pairs separated by commas")
	}
	keys := map[string][]byte{}
	for _, entry := range entries {
		kid, encoded, found := strings.Cut(entry, ":")
		if !found || kid == "" {
			return nil, fmt.Errorf("REALTIME_SIGNING_KEYS entry %q is not kid:key", kid)
		}
		key, err := base64.RawURLEncoding.DecodeString(encoded)
		if err != nil {
			return nil, fmt.Errorf("REALTIME_SIGNING_KEYS key %q is not base64url: %w", kid, err)
		}
		if len(key) < 32 {
			return nil, fmt.Errorf("REALTIME_SIGNING_KEYS key %q is shorter than 32 bytes", kid)
		}
		keys[kid] = key
	}
	return keys, nil
}

func splitList(raw string) []string {
	var items []string
	for item := range strings.SplitSeq(raw, ",") {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			items = append(items, trimmed)
		}
	}
	return items
}

func stringOr(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func intOr(name string, fallback int) (int, error) {
	value := os.Getenv(name)
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("%s must be a positive integer", name)
	}
	return parsed, nil
}
