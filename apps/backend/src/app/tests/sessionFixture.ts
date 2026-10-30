import Auth from '@fastify/auth'
import Sensible from '@fastify/sensible'
import SecureSession from '@fastify/secure-session'
import Fastify, { type FastifyInstance } from 'fastify'
import type { LightMyRequestResponse } from 'fastify'
import { randomBytes } from 'node:crypto'
import {
    MemorySessionStore,
    SessionService,
    type SessionServiceOptions
} from '@tabletop/backend-services'
import RateLimitPlugin from '../plugins/rateLimit.js'

const SESSION_COOKIE = '__session'

export async function sessionServer(
    sessions: SessionService = memorySessions().sessionService
): Promise<FastifyInstance> {
    const server = Fastify()
    await server.register(SecureSession, {
        sessionName: 'session',
        cookieName: SESSION_COOKIE,
        key: randomBytes(32),
        cookie: { path: '/', httpOnly: true }
    })
    await server.register(Auth)
    await server.register(Sensible)
    await server.register(RateLimitPlugin, { service: 'local' })
    server.decorate('sessionService', sessions)
    return server
}

export function memorySessions(options: SessionServiceOptions = {}) {
    const sessionStore = new MemorySessionStore()
    const sessionService = new SessionService(sessionStore, options)
    return { sessionStore, sessionService }
}

export function sessionCookieHeader(response: LightMyRequestResponse): string | undefined {
    const cookie = response.cookies.find((candidate) => candidate.name === SESSION_COOKIE)
    return cookie ? `${SESSION_COOKIE}=${encodeURIComponent(cookie.value)}` : undefined
}
