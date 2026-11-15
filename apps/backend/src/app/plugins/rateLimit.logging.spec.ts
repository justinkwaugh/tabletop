import Fastify, { type FastifyInstance } from 'fastify'
import SecureSession from '@fastify/secure-session'
import { randomBytes } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
    vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop')
})
import { LoggingBoundary } from '../lib/logging.js'
import RateLimitPlugin from './rateLimit.js'

const SSE_TOKEN = 'SYNTHETIC-SSE-TOKEN-7f3a'
const CODE = 'SYNTHETIC-CODE-7f3a'

const servers = new Set<FastifyInstance>()
afterEach(async () => {
    for (const server of servers) await server.close()
    servers.clear()
    vi.restoreAllMocks()
})

// The production logger, session plugin and request limits, with every console channel
// captured as well as the pino stream
async function limitedServer() {
    const lines: string[] = []
    const consoleLines: string[] = []
    for (const level of ['log', 'warn', 'error', 'info', 'debug'] as const) {
        vi.spyOn(console, level).mockImplementation((...parts: unknown[]) => {
            consoleLines.push(parts.map(String).join(' '))
        })
    }
    const logging = new LoggingBoundary()
    const server = Fastify({
        logger: {
            ...logging.loggerOptions,
            stream: {
                write: (line: string) => {
                    lines.push(line)
                }
            }
        }
    })
    logging.observeRoutes(server)
    servers.add(server)
    await server.register(SecureSession, {
        sessionName: 'session',
        cookieName: '__session',
        key: randomBytes(32),
        cookie: { path: '/', httpOnly: true }
    })
    await server.register(RateLimitPlugin, { service: 'backend' })
    server.get(
        '/api/v1/sse/user/:token',
        { config: { rateLimit: { max: 1, timeWindow: '1 minute' } } },
        async () => ({})
    )
    server.get(
        '/api/v1/auth/discord/callback',
        { config: { rateLimit: { max: 1, timeWindow: '1 minute' } } },
        async () => ({})
    )
    return { server, logged: () => lines.join(''), consoleOutput: () => consoleLines.join('\n') }
}

describe('request limits', () => {
    it('report a throttled credential path through the logging boundary, not the console', async () => {
        const { server, logged, consoleOutput } = await limitedServer()

        await server.inject({ method: 'GET', url: `/api/v1/sse/user/${SSE_TOKEN}` })
        const denied = await server.inject({ method: 'GET', url: `/api/v1/sse/user/${SSE_TOKEN}` })

        expect(denied.statusCode).toBe(429)
        expect(logged()).toContain('"msg":"Request limit exceeded"')
        expect(logged()).toContain('"key":"client:127.0.0.1"')
        expect(logged()).toContain('"url":"/api/v1/sse/user/[redacted]"')
        expect(logged()).toContain('"statusCode":429')
        expect(logged()).not.toContain(SSE_TOKEN)
        expect(consoleOutput()).not.toContain(SSE_TOKEN)
        expect(consoleOutput()).not.toContain('LIMIT EXCEEDED')
    })

    it('report a throttled credential query, encoded name included, without the credential', async () => {
        const { server, logged, consoleOutput } = await limitedServer()

        await server.inject({ method: 'GET', url: `/api/v1/auth/discord/callback?code=${CODE}` })
        const denied = await server.inject({
            method: 'GET',
            url: `/api/v1/auth/discord/callback?%63ode=${CODE}&page=2`
        })

        expect(denied.statusCode).toBe(429)
        expect(logged()).toContain('"url":"/api/v1/auth/discord/callback?%63ode=[redacted]&page=2"')
        expect(logged()).not.toContain(CODE)
        expect(consoleOutput()).not.toContain(CODE)
    })
})
