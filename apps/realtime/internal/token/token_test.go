package token

import (
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	now     = time.Unix(1_800_000_000, 0)
	testKey = []byte("0123456789abcdef0123456789abcdef")
)

func verifier() *Verifier {
	return NewVerifier(map[string][]byte{"k1": testKey}, func() time.Time { return now })
}

func validClaims() jwt.MapClaims {
	return jwt.MapClaims{
		"sub":    "user-a",
		"topics": []string{"user-user-a", "global", "game-g1"},
		"aud":    Audience,
		"iat":    now.Unix(),
		"exp":    now.Add(time.Minute).Unix(),
		"jti":    "token-1",
	}
}

func sign(t *testing.T, method jwt.SigningMethod, kid string, claims jwt.MapClaims, key any) string {
	t.Helper()
	unsigned := jwt.NewWithClaims(method, claims)
	if kid != "" {
		unsigned.Header["kid"] = kid
	}
	signed, err := unsigned.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return signed
}

func TestVerifyAcceptsAValidToken(t *testing.T) {
	registration, err := verifier().Verify(sign(t, jwt.SigningMethodHS256, "k1", validClaims(), testKey))
	if err != nil {
		t.Fatal(err)
	}
	if registration.Account != "user-a" || registration.ID != "token-1" {
		t.Fatalf("unexpected registration %+v", registration)
	}
	if want := []string{"game-g1", "global", "user-user-a"}; !equal(registration.Topics, want) {
		t.Fatalf("topics %v, want %v", registration.Topics, want)
	}
	if !registration.IssuedAt.Equal(now) || !registration.ExpiresAt.Equal(now.Add(time.Minute)) {
		t.Fatalf("unexpected times %+v", registration)
	}
}

func TestVerifyRejects(t *testing.T) {
	without := func(name string) jwt.MapClaims {
		claims := validClaims()
		delete(claims, name)
		return claims
	}
	with := func(name string, value any) jwt.MapClaims {
		claims := validClaims()
		claims[name] = value
		return claims
	}
	cases := map[string]string{
		"another algorithm":         sign(t, jwt.SigningMethodHS384, "k1", validClaims(), testKey),
		"no algorithm":              sign(t, jwt.SigningMethodNone, "k1", validClaims(), jwt.UnsafeAllowNoneSignatureType),
		"an unknown kid":            sign(t, jwt.SigningMethodHS256, "k2", validClaims(), testKey),
		"a missing kid":             sign(t, jwt.SigningMethodHS256, "", validClaims(), testKey),
		"a kid only in the payload": sign(t, jwt.SigningMethodHS256, "", with("kid", "k1"), testKey),
		"another key":               sign(t, jwt.SigningMethodHS256, "k1", validClaims(), []byte("fedcba9876543210fedcba9876543210")),
		"an expired token":          sign(t, jwt.SigningMethodHS256, "k1", with("exp", now.Add(-ClockLeeway-time.Second).Unix()), testKey),
		"a future iat":              sign(t, jwt.SigningMethodHS256, "k1", with("iat", now.Add(time.Minute).Unix()), testKey),
		"another audience":          sign(t, jwt.SigningMethodHS256, "k1", with("aud", "elsewhere"), testKey),
		"no audience":               sign(t, jwt.SigningMethodHS256, "k1", without("aud"), testKey),
		"no exp":                    sign(t, jwt.SigningMethodHS256, "k1", without("exp"), testKey),
		"no iat":                    sign(t, jwt.SigningMethodHS256, "k1", without("iat"), testKey),
		"no sub":                    sign(t, jwt.SigningMethodHS256, "k1", without("sub"), testKey),
		"no jti":                    sign(t, jwt.SigningMethodHS256, "k1", without("jti"), testKey),
		"no topics":                 sign(t, jwt.SigningMethodHS256, "k1", with("topics", []string{}), testKey),
		"the control channel": sign(t, jwt.SigningMethodHS256, "k1",
			with("topics", []string{"global", ControlChannel}), testKey),
		"a lifetime over a minute": sign(t, jwt.SigningMethodHS256, "k1",
			with("exp", now.Add(time.Minute+time.Second).Unix()), testKey),
		"garbage": "not.a.token",
	}
	for name, raw := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := verifier().Verify(raw); !errors.Is(err, ErrInvalid) {
				t.Fatalf("got %v, want ErrInvalid", err)
			}
		})
	}
}

func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
