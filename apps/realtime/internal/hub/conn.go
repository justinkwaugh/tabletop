package hub

type Conn struct {
	account string
	topics  []string
	frames  chan []byte
	closed  chan struct{}

	ready             bool
	dropped           bool
	unconfirmedTopics int
}

func newConn(account string, topics []string, buffer int) *Conn {
	return &Conn{
		account: account,
		topics:  topics,
		frames:  make(chan []byte, buffer),
		closed:  make(chan struct{}),
	}
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
