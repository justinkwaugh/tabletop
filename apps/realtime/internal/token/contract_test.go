package token

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"slices"
	"strings"
	"testing"
	"time"
)

type tokenContract struct {
	SigningKey   string           `json:"signingKey"`
	UserID       string           `json:"userId"`
	Topics       []string         `json:"topics"`
	UntilSeconds map[string]int64 `json:"untilSeconds"`
	NowMillis    int64            `json:"nowMillis"`
	TokenID    string   `json:"tokenId"`
	Token      string   `json:"token"`
}

func TestVerifiesTheTokenTheBackendSigns(t *testing.T) {
	raw, err := os.ReadFile("../../testdata/token-contract.json")
	if err != nil {
		t.Fatal(err)
	}
	var contract tokenContract
	if err := json.Unmarshal(raw, &contract); err != nil {
		t.Fatal(err)
	}
	kid, encoded, _ := strings.Cut(contract.SigningKey, ":")
	key, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatal(err)
	}
	now := time.UnixMilli(contract.NowMillis)

	registration, err := NewVerifier(map[string][]byte{kid: key}, func() time.Time { return now }).Verify(contract.Token)
	if err != nil {
		t.Fatal(err)
	}
	if registration.Account != contract.UserID || registration.ID != contract.TokenID {
		t.Fatalf("unexpected registration %+v", registration)
	}
	if !slices.Equal(registration.Topics, slices.Sorted(slices.Values(contract.Topics))) {
		t.Fatalf("topics %v, want %v", registration.Topics, contract.Topics)
	}
	if !registration.IssuedAt.Equal(now.Truncate(time.Second)) || registration.ExpiresAt.Sub(registration.IssuedAt) != MaxLifetime {
		t.Fatalf("unexpected times %+v", registration)
	}
	if len(registration.Until) != len(contract.UntilSeconds) {
		t.Fatalf("grant ends %v, want %v", registration.Until, contract.UntilSeconds)
	}
	for topic, seconds := range contract.UntilSeconds {
		if !registration.Until[topic].Equal(time.Unix(seconds, 0)) {
			t.Fatalf("grant end of %s %v, want %v", topic, registration.Until[topic], time.Unix(seconds, 0))
		}
	}
}
