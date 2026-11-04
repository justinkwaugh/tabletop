import type net from 'node:net'

export type LoopbackService<S extends net.Server> = {
    server: S
    port: number
    connections: net.Socket[]
}

export async function listenOnLoopback<S extends net.Server>(
    server: S
): Promise<LoopbackService<S>> {
    const connections: net.Socket[] = []
    server.on('connection', (socket: net.Socket) => connections.push(socket))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (typeof address !== 'object' || address === null) {
        throw new Error('loopback service did not bind a TCP port')
    }
    return { server, port: address.port, connections }
}

export function closeServer(server: net.Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
    })
}
