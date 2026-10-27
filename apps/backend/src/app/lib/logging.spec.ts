import Fastify, { type FastifyInstance } from 'fastify'
import { BaseError } from '@tabletop/common'
import { concealedCause, secretReference } from '@tabletop/backend-services'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
    vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop')
})
import { LoggingBoundary } from './logging.js'

const SSE_TOKEN = 'SYNTHETIC-SSE-TOKEN-7f3a'
const SHORT_CODE = 'AbC456'
const CODE = 'SYNTHETIC-PROVIDER-CODE'
const STATE = 'login.SYNTHETIC-STATE-NONCE'
const SESSION_ID = 'SYNTHETIC-SESSION-ID-9c1d'
const PASSWORD = 'SYNTHETIC-PASSWORD'

const servers = new Set<FastifyInstance>()
afterEach(async () => {
    for (const server of servers) await server.close()
    servers.clear()
})

function capturingServer() {
    const lines: string[] = []
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
    server.get('/api/v1/sse/user/:token', async () => ({}))
    server.get('/api/v1/sse/game/:gameId/:token', async () => ({}))
    server.get('/api/v1/invitation/token/:token', async () => ({}))
    server.get('/api/v1/auth/discord/callback', async (request) => request.query)
    server.get('/api/v1/games/mine', async () => ({}))
    servers.add(server)
    return { server, logging, logged: () => lines.join('') }
}

describe('request log lines', () => {
    it('mask credential path and query parameters of matched requests', async () => {
        const { server, logged } = capturingServer()

        await server.inject({ method: 'GET', url: `/api/v1/sse/user/${SSE_TOKEN}` })
        await server.inject({ method: 'GET', url: `/api/v1/sse/game/game-42/${SSE_TOKEN}` })
        await server.inject({
            method: 'GET',
            url: `/api/v1/auth/discord/callback?code=${CODE}&state=${STATE}&game=game-42`
        })

        expect(logged()).toContain('"url":"/api/v1/sse/user/[redacted]"')
        expect(logged()).toContain('"url":"/api/v1/sse/game/game-42/[redacted]"')
        expect(logged()).toContain(
            '"url":"/api/v1/auth/discord/callback?code=[redacted]&state=[redacted]&game=game-42"'
        )
        expect(logged()).toContain('"statusCode":200')
        expect(logged()).not.toContain(SSE_TOKEN)
        expect(logged()).not.toContain(CODE)
        expect(logged()).not.toContain(STATE)
    })

    it('mask a credential path of a rejected request in the request line and the 404 message', async () => {
        const { server, logged } = capturingServer()

        const wrongMethod = await server.inject({
            method: 'POST',
            url: `/api/v1/sse/user/${SHORT_CODE}`
        })
        await server.inject({
            method: 'DELETE',
            url: `/api/v1/sse/game/game-42/${SHORT_CODE}?state=${STATE}&page=2`
        })
        await server.inject({ method: 'POST', url: `/api/v1/invitation/token/${SHORT_CODE}` })
        await server.inject({ method: 'POST', url: '/api/v1/games/mine?page=2' })

        expect(wrongMethod.statusCode).toBe(404)
        expect(logged()).toContain('"url":"/api/v1/sse/user/[redacted]"')
        expect(logged()).toContain('Route POST:/api/v1/sse/user/[redacted] not found')
        expect(logged()).toContain(
            'Route DELETE:/api/v1/sse/game/game-42/[redacted]?state=[redacted]&page=2 not found'
        )
        expect(logged()).toContain('Route POST:/api/v1/invitation/token/[redacted] not found')
        expect(logged()).toContain('Route POST:/api/v1/games/mine?page=2 not found')
        expect(logged()).toContain('"statusCode":404')
        expect(logged()).not.toContain(SHORT_CODE)
        expect(logged()).not.toContain(STATE)
    })

    it('classify a query parameter by its decoded name, as Fastify reads it', async () => {
        const { server, logged } = capturingServer()

        const encoded = await server.inject({
            method: 'GET',
            url: `/api/v1/auth/discord/callback?%63ode=${CODE}&page=2&%53TATE=${STATE}&Code=${SHORT_CODE}&code=${CODE}`
        })
        const malformed = await server.inject({
            method: 'GET',
            url: `/api/v1/auth/discord/callback?%E0%A4%A=plain&code=${CODE}&c%ZZde=kept`
        })

        expect(encoded.json()).toMatchObject({
            code: [CODE, CODE],
            page: '2',
            STATE,
            Code: SHORT_CODE
        })
        expect(malformed.json()).toEqual({ '%E0%A4%A': 'plain', code: CODE, 'c%ZZde': 'kept' })
        expect(logged()).toContain(
            '"url":"/api/v1/auth/discord/callback?%63ode=[redacted]&page=2&%53TATE=[redacted]&Code=[redacted]&code=[redacted]"'
        )
        expect(logged()).toContain(
            '"url":"/api/v1/auth/discord/callback?%E0%A4%A=plain&code=[redacted]&c%ZZde=kept"'
        )
        for (const line of logged()
            .split('\n')
            .filter((line) => line.length > 0)) {
            expect(() => JSON.parse(line)).not.toThrow()
        }
        expect(logged()).not.toContain(CODE)
        expect(logged()).not.toContain(STATE)
        expect(logged()).not.toContain(SHORT_CODE)
    })

    it('mask structured URL fields the way the rate limiter logs them', () => {
        const { server, logged } = capturingServer()

        server.log.warn(
            { key: 'client:10.0.0.1', url: `/api/v1/sse/user/${SHORT_CODE}` },
            'Request limit exceeded'
        )
        server.log.warn(
            { ingressPeer: '10.0.0.2', url: `/api/v1/sse/game/game-42/${SHORT_CODE}?code=${CODE}` },
            'Hosting peer request limit exceeded'
        )

        expect(logged()).toContain('"key":"client:10.0.0.1"')
        expect(logged()).toContain('"url":"/api/v1/sse/user/[redacted]"')
        expect(logged()).toContain('"url":"/api/v1/sse/game/game-42/[redacted]?code=[redacted]"')
        expect(logged()).not.toContain(SHORT_CODE)
        expect(logged()).not.toContain(CODE)
    })

    it('mask credential paths and parameters inside message text and interpolated arguments', () => {
        const { server, logged } = capturingServer()

        server.log.info(
            'redirecting to https://site.test/api/v1/invitation/token/%s after %s',
            SHORT_CODE,
            `https://site.test/oauth?state=${STATE}`
        )
        server.log.info(`presented Bearer ${SSE_TOKEN} for /api/v1/games/mine`)

        expect(logged()).toContain(
            'redirecting to https://site.test/api/v1/invitation/token/[redacted] after https://site.test/oauth?state=[redacted]'
        )
        expect(logged()).toContain('presented Bearer [redacted] for /api/v1/games/mine')
        expect(logged()).not.toContain(SHORT_CODE)
        expect(logged()).not.toContain(STATE)
        expect(logged()).not.toContain(SSE_TOKEN)
    })
})

describe('logged objects and errors', () => {
    it('redact credential fields at any depth and in URL strings while keeping diagnostics', () => {
        const { server, logged } = capturingServer()
        server.log.warn(
            {
                key: 'client:10.0.0.1',
                url: `/api/v1/auth/discord/login?code=${CODE}&state=${STATE}`,
                password: PASSWORD,
                headers: { cookie: `__session=${SESSION_ID}`, 'user-agent': 'spec' },
                binding: { kind: 'session', sessionId: SESSION_ID, userId: 'account-1' },
                attempts: [{ token: SSE_TOKEN, outcome: 'refused' }]
            },
            'Request limit exceeded'
        )

        expect(logged()).toContain('"key":"client:10.0.0.1"')
        expect(logged()).toContain(
            '"url":"/api/v1/auth/discord/login?code=[redacted]&state=[redacted]"'
        )
        expect(logged()).toContain('"password":"[redacted]"')
        expect(logged()).toContain('"user-agent":"spec"')
        expect(logged()).toContain('"userId":"account-1"')
        expect(logged()).toContain('"outcome":"refused"')
        expect(logged()).not.toContain(PASSWORD)
        expect(logged()).not.toContain(SESSION_ID)
        expect(logged()).not.toContain(SSE_TOKEN)
        expect(logged()).not.toContain(CODE)
    })

    it('redact credential fields of a serialized error and keep its causes readable', () => {
        const { server, logged } = capturingServer()
        const storage = Object.assign(new Error('5 NOT_FOUND: no such document'), { code: 5 })
        const failure = new BaseError({
            name: 'SessionStorageError',
            message: 'The session could not be stored',
            metadata: {
                sessionId: SESSION_ID,
                operation: 'create',
                request: { headers: { authorization: `Bearer ${SSE_TOKEN}`, accept: 'json' } }
            },
            cause: storage
        })
        server.log.error({ err: failure }, 'Request failed')
        server.log.error({ error: Object.assign(new Error('boom'), { token: SSE_TOKEN }) }, 'Other')

        expect(logged()).toContain('"type":"BaseError"')
        expect(logged()).toContain('The session could not be stored: 5 NOT_FOUND: no such document')
        expect(logged()).toContain('caused by: Error: 5 NOT_FOUND: no such document')
        expect(logged()).toContain('"operation":"create"')
        expect(logged()).toContain('"sessionId":"[redacted]"')
        expect(logged()).toContain('"authorization":"[redacted]"')
        expect(logged()).toContain('"accept":"json"')
        expect(logged()).toContain('"message":"boom"')
        expect(logged()).toContain('"token":"[redacted]"')
        expect(logged()).not.toContain(SESSION_ID)
        expect(logged()).not.toContain(SSE_TOKEN)
    })

    it('conceal a provider error quoting a short code in a custom response class without digesting it', () => {
        const { server, logged } = capturingServer()
        class ProviderResponse {
            constructor(
                readonly details: string,
                readonly headers: Map<string, string>
            ) {}
        }
        const provider = Object.assign(
            new Error(
                `Resend rejected https://api.test/send?token=${SHORT_CODE} for ${SHORT_CODE}`
            ),
            {
                response: new ProviderResponse(
                    `provider quoted ${SHORT_CODE}`,
                    new Map([['x-request-id', 'req-1']])
                ),
                cause: new Error(`socket closed while sending ${SHORT_CODE}`)
            }
        )
        const delivery = new BaseError({
            name: 'EmailDeliveryError',
            message: 'The password-reset email could not be delivered',
            metadata: { kind: 'password-reset' },
            cause: concealedCause(provider, [SHORT_CODE])
        })

        server.log.error({ err: concealedCause(provider, [SHORT_CODE]) }, 'Delivery failed')
        server.log.error({ err: delivery }, 'Request failed')

        expect(logged()).toContain('"kind":"password-reset"')
        expect(logged()).toContain('"details":"provider quoted [redacted]"')
        expect(logged()).toContain(
            'Resend rejected https://api.test/send?token=[redacted] for [redacted]'
        )
        expect(logged()).toContain('socket closed while sending [redacted]')
        expect(logged()).not.toContain(SHORT_CODE)
        expect(logged()).not.toContain(secretReference(SHORT_CODE))
        expect(provider.message).toContain(SHORT_CODE)
        expect(provider.response.details).toContain(SHORT_CODE)
        expect(provider.cause.message).toContain(SHORT_CODE)
    })
})
