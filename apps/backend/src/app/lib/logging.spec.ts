import Fastify, { type FastifyInstance } from 'fastify'
import { BaseError } from '@tabletop/common'
import { afterEach, describe, expect, it } from 'vitest'
import { concealUrlQuery, loggableUrl, loggerOptions } from './logging.js'

const SSE_TOKEN = 'SYNTHETIC-SSE-TOKEN-7f3a'
const CODE = 'SYNTHETIC-PROVIDER-CODE'
const STATE = 'login.SYNTHETIC-STATE-NONCE'
const SESSION_ID = 'SYNTHETIC-SESSION-ID-9c1d'
const PASSWORD = 'SYNTHETIC-PASSWORD'

const servers = new Set<FastifyInstance>()
afterEach(async () => {
    for (const server of servers) await server.close()
    servers.clear()
})

export function capturingServer() {
    const lines: string[] = []
    const server = Fastify({
        logger: {
            ...loggerOptions,
            stream: {
                write: (line: string) => {
                    lines.push(line)
                }
            }
        }
    })
    servers.add(server)
    return { server, logged: () => lines.join('') }
}

describe('request log lines', () => {
    it('mask credential path and query parameters and keep the rest of the URL', async () => {
        const { server, logged } = capturingServer()
        server.get<{ Params: { token: string } }>('/sse/user/:token', async () => ({}))
        server.get<{ Params: { gameId: string; token: string } }>(
            '/sse/game/:gameId/:token',
            async () => ({})
        )
        server.get('/oauth/callback', async () => ({}))

        await server.inject({ method: 'GET', url: `/sse/user/${SSE_TOKEN}` })
        await server.inject({ method: 'GET', url: `/sse/game/game-42/${SSE_TOKEN}` })
        await server.inject({
            method: 'GET',
            url: `/oauth/callback?code=${CODE}&state=${STATE}&game=game-42`
        })

        expect(logged()).toContain('"url":"/sse/user/[redacted]"')
        expect(logged()).toContain('"url":"/sse/game/game-42/[redacted]"')
        expect(logged()).toContain(
            '"url":"/oauth/callback?code=[redacted]&state=[redacted]&game=game-42"'
        )
        expect(logged()).toContain('"statusCode":200')
        expect(logged()).not.toContain(SSE_TOKEN)
        expect(logged()).not.toContain(CODE)
        expect(logged()).not.toContain(STATE)
    })

    it('mask a credential path parameter the route declared under any credential name', () => {
        expect(
            loggableUrl({
                url: `/api/v1/invitation/token/${SSE_TOKEN}?x=1`,
                params: { token: SSE_TOKEN }
            })
        ).toBe('/api/v1/invitation/token/[redacted]?x=1')
        expect(
            loggableUrl({
                url: `/email/passwordReset/account-1.${SSE_TOKEN}`,
                params: { challenge: `account-1.${SSE_TOKEN}` }
            })
        ).toBe('/email/passwordReset/[redacted]')
        expect(loggableUrl({ url: '/api/v1/games/mine?page=2', params: {} })).toBe(
            '/api/v1/games/mine?page=2'
        )
        expect(concealUrlQuery(`https://site.test/oauth/discord?code=${CODE}&state=${STATE}`)).toBe(
            'https://site.test/oauth/discord?code=[redacted]&state=[redacted]'
        )
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
})
