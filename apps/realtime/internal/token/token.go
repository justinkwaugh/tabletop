package token

import (
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	Audience       = "realtime"
	ControlChannel = "realtime-control"
	StatsTopic     = "relay-stats"
	MaxLifetime    = time.Minute
	ClockLeeway    = 5 * time.Second
	// A Topic that confers administrative sight is granted for a bounded time, never for the
	// life of the connection: the backend ends it with the Admin Mode it was issued under.
	MaxGrantLifetime = 15 * time.Minute
)

var ErrInvalid = errors.New("invalid token")

type Registration struct {
	Account   string
	Topics    []string
	Until     map[string]time.Time // when the grant of a Topic ends, for the Topics that have an end
	IssuedAt  time.Time
	ExpiresAt time.Time
	ID        string
}

type Verifier struct {
	keys map[string][]byte
	now  func() time.Time
}

func NewVerifier(keys map[string][]byte, now func() time.Time) *Verifier {
	return &Verifier{keys: keys, now: now}
}

type registrationClaims struct {
	Topics []string         `json:"topics"`
	Until  map[string]int64 `json:"until,omitempty"`
	jwt.RegisteredClaims
}

func (v *Verifier) Verify(raw string) (Registration, error) {
	var claims registrationClaims
	_, err := jwt.ParseWithClaims(raw, &claims, v.key,
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithAudience(Audience),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithLeeway(ClockLeeway),
		jwt.WithTimeFunc(v.now),
		jwt.WithStrictDecoding(),
	)
	if err != nil {
		return Registration{}, fmt.Errorf("%w: %v", ErrInvalid, err)
	}
	return v.registration(claims)
}

func (v *Verifier) key(t *jwt.Token) (any, error) {
	kid, ok := t.Header["kid"].(string)
	if !ok {
		return nil, errors.New("missing kid")
	}
	key, ok := v.keys[kid]
	if !ok {
		return nil, fmt.Errorf("unknown kid %q", kid)
	}
	return key, nil
}

func (v *Verifier) registration(claims registrationClaims) (Registration, error) {
	switch {
	case claims.Subject == "":
		return Registration{}, fmt.Errorf("%w: missing sub", ErrInvalid)
	case claims.ID == "":
		return Registration{}, fmt.Errorf("%w: missing jti", ErrInvalid)
	case claims.IssuedAt == nil:
		return Registration{}, fmt.Errorf("%w: missing iat", ErrInvalid)
	case len(claims.Topics) == 0:
		return Registration{}, fmt.Errorf("%w: no topics", ErrInvalid)
	case slices.Contains(claims.Topics, ControlChannel):
		return Registration{}, fmt.Errorf("%w: grants the control channel", ErrInvalid)
	case claims.ExpiresAt.Sub(claims.IssuedAt.Time) > MaxLifetime:
		return Registration{}, fmt.Errorf("%w: lifetime over %s", ErrInvalid, MaxLifetime)
	case slices.Contains(claims.Topics, StatsTopic) && claims.Until[StatsTopic] == 0:
		return Registration{}, fmt.Errorf("%w: grants %s without an end", ErrInvalid, StatsTopic)
	}
	until, err := grantEnds(claims)
	if err != nil {
		return Registration{}, err
	}
	return Registration{
		Account:   claims.Subject,
		Topics:    slices.Compact(slices.Sorted(slices.Values(claims.Topics))),
		Until:     until,
		IssuedAt:  claims.IssuedAt.Time,
		ExpiresAt: claims.ExpiresAt.Time,
		ID:        claims.ID,
	}, nil
}

func grantEnds(claims registrationClaims) (map[string]time.Time, error) {
	if len(claims.Until) == 0 {
		return nil, nil
	}
	until := make(map[string]time.Time, len(claims.Until))
	for topic, seconds := range claims.Until {
		end := time.Unix(seconds, 0)
		switch {
		case !slices.Contains(claims.Topics, topic):
			return nil, fmt.Errorf("%w: ends a grant of %s it does not make", ErrInvalid, topic)
		case !end.After(claims.IssuedAt.Time):
			return nil, fmt.Errorf("%w: grant of %s ended before it was issued", ErrInvalid, topic)
		case end.Sub(claims.IssuedAt.Time) > MaxGrantLifetime:
			return nil, fmt.Errorf("%w: grant of %s over %s", ErrInvalid, topic, MaxGrantLifetime)
		}
		until[topic] = end
	}
	return until, nil
}
