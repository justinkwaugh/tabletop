package hub

import (
	"crypto/rand"
	"encoding/base64"
)

type Conn struct {
	id      string
	account string
	frames  chan []byte
	closed  chan struct{}

	topics    map[string]bool
	awaiting  map[string]struct{}
	announced bool
	dropped   bool
	farewell  []byte
}

func newConn(account string, buffer int) *Conn {
	return &Conn{
		id:       newConnID(),
		account:  account,
		frames:   make(chan []byte, buffer),
		closed:   make(chan struct{}),
		topics:   map[string]bool{},
		awaiting: map[string]struct{}{},
	}
}

func newConnID() string {
	id := make([]byte, 16)
	_, _ = rand.Read(id)
	return base64.RawURLEncoding.EncodeToString(id)
}

func (c *Conn) Account() string {
	return c.account
}

func (c *Conn) Frames() <-chan []byte {
	return c.frames
}

func (c *Conn) Closed() <-chan struct{} {
	return c.closed
}

func (c *Conn) Farewell() []byte {
	return c.farewell
}
