import * as http from 'node:http'
import * as http2 from 'node:http2'
import type { Socket } from 'node:net'
import type { BackendSupervisor } from './backendSupervisor.js'
import { probeBackend } from './backendHealth.js'

function forwardingHeaders(headers: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
    const excluded = new Set([
        'connection',
        'keep-alive',
        'proxy-connection',
        'transfer-encoding',
        'upgrade',
        'http2-settings',
        'te',
        'trailer',
        ...(headers.connection ?? '')
            .toLowerCase()
            .split(',')
            .map((name) => name.trim())
    ])
    return Object.fromEntries(
        Object.entries(headers).filter(([name]) => !name.startsWith(':') && !excluded.has(name))
    )
}

export function createBackendGateway(http2Enabled: boolean, supervisor: BackendSupervisor) {
    const agent = new http.Agent({ keepAlive: true })
    const sockets = new Set<Socket>()
    const sessions = new Set<http2.ServerHttp2Session>()
    const forward = async (
        request: http.IncomingMessage | http2.Http2ServerRequest,
        response: http.ServerResponse | http2.Http2ServerResponse
    ) => {
        if (request.url === '/__health/ready') {
            response.statusCode = (await probeBackend(supervisor)) ? 200 : 503
            response.setHeader('cache-control', 'no-store')
            response.end()
            return
        }
        const cancellation = new AbortController()
        const cancel = () => cancellation.abort()
        response.once('close', cancel)
        let target
        try {
            target = await supervisor.acquireWhenReady(
                AbortSignal.any([cancellation.signal, AbortSignal.timeout(120_000)])
            )
        } catch {
            if (!response.destroyed) {
                response.statusCode = 503
                response.setHeader('retry-after', '1')
                response.end('Service temporarily unavailable')
            }
            return
        } finally {
            response.removeListener('close', cancel)
        }
        if (response.destroyed) {
            target.release()
            return
        }
        const headers = forwardingHeaders(request.headers)
        const authority = request.headers[':authority']
        const host = typeof authority === 'string' ? authority : request.headers.host
        if (!host) {
            target.release()
            response.statusCode = 400
            response.end('Host header is required')
            return
        }
        headers.host = host
        headers['x-forwarded-for'] = request.socket.remoteAddress ?? ''
        let incomingResponse: http.IncomingMessage | undefined
        const fail = () => {
            if (response.headersSent) response.destroy()
            else {
                response.statusCode = 502
                response.end('Backend connection closed')
            }
        }
        let upstream: http.ClientRequest
        try {
            upstream = http.request(
                {
                    hostname: '127.0.0.1',
                    port: target.port,
                    path: request.url,
                    method: request.method,
                    headers,
                    agent
                },
                (incoming) => {
                    incomingResponse = incoming
                    incoming.on('error', () => response.destroy())
                    if (response.destroyed) {
                        if (incoming.headers['content-type']?.startsWith('text/event-stream')) {
                            incoming.destroy()
                        } else incoming.resume()
                        return
                    }
                    response.statusCode = incoming.statusCode ?? 502
                    for (const [name, value] of Object.entries(
                        forwardingHeaders(incoming.headers)
                    )) {
                        if (value !== undefined) response.setHeader(name, value)
                    }
                    if (response instanceof http.ServerResponse) response.flushHeaders()
                    else response.writeHead(response.statusCode)
                    incoming.pipe(response)
                }
            )
        } catch {
            target.release()
            fail()
            return
        }
        upstream.once('close', target.release)
        upstream.on('error', fail)
        const disconnect = () => {
            if (
                !request.complete ||
                incomingResponse?.headers['content-type']?.startsWith('text/event-stream')
            ) {
                upstream.destroy()
            } else {
                incomingResponse?.unpipe(response)
                incomingResponse?.resume()
            }
        }
        request.on('error', disconnect)
        request.on('aborted', disconnect)
        response.on('close', disconnect)
        request.pipe(upstream)
    }
    const server = http2Enabled ? http2.createServer({}, forward) : http.createServer(forward)
    server.on('connection', (socket) => {
        sockets.add(socket)
        socket.once('close', () => sockets.delete(socket))
    })
    if (http2Enabled) {
        server.on('session', (session: http2.ServerHttp2Session) => {
            sessions.add(session)
            session.once('close', () => sessions.delete(session))
        })
    }
    return {
        server,
        async close() {
            const closed = new Promise<void>((resolve) => server.close(() => resolve()))
            for (const session of sessions) session.close()
            const timeout = setTimeout(() => {
                for (const session of sessions) session.destroy()
                for (const socket of sockets) socket.destroy()
            }, 8_000)
            await closed
            clearTimeout(timeout)
            agent.destroy()
        }
    }
}
