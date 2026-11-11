import { once } from 'node:events'
import { connect, createServer, type AddressInfo, type Socket } from 'node:net'

/** A private TCP hop to Redis, so a spec can cut or stall its own connection, not the server. */
export class RedisProxy {
    private readonly server = createServer((downstream) => this.relay(downstream))
    private readonly sockets = new Set<Socket>()
    private heldReplies: (() => void)[] = []
    private stalled = false
    port = 0

    constructor(
        private readonly host: string,
        private readonly redisPort = 6379
    ) {}

    async open(): Promise<void> {
        this.server.listen(this.port, '127.0.0.1')
        await once(this.server, 'listening')
        const address: AddressInfo | string | null = this.server.address()
        if (typeof address !== 'object' || !address) throw new Error('Proxy has no TCP address')
        this.port = address.port
    }

    /** Drops every connection and refuses new ones, as an outage does. */
    async cut(): Promise<void> {
        const closed = once(this.server, 'close')
        this.server.close()
        for (const socket of this.sockets) socket.destroy()
        await closed
    }

    /** Keeps connections open but holds back Redis's replies, as an unresponsive network does. */
    stall(): void {
        this.stalled = true
    }

    resume(): void {
        this.stalled = false
        for (const deliver of this.heldReplies) deliver()
        this.heldReplies = []
    }

    async close(): Promise<void> {
        if (this.server.listening) await this.cut()
    }

    private relay(downstream: Socket): void {
        const upstream = connect(this.redisPort, this.host)
        for (const [socket, other] of [
            [downstream, upstream],
            [upstream, downstream]
        ]) {
            this.sockets.add(socket)
            socket.on('error', () => other.destroy())
            socket.on('close', () => {
                this.sockets.delete(socket)
                other.destroy()
            })
        }
        downstream.on('data', (chunk) => upstream.write(chunk))
        upstream.on('data', (chunk) => {
            if (this.stalled) this.heldReplies.push(() => downstream.write(chunk))
            else downstream.write(chunk)
        })
    }
}
