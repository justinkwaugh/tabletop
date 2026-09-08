import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { measure, countTiming } from '@tabletop/backend-services/diagnostics'
import { setTimeout as delay } from 'node:timers/promises'
import requestTimings from './requestTimings.js'

async function fixture(enabled = true) {
    const logs: Record<string, unknown>[] = []
    const server = Fastify({
        logger: {
            stream: {
                write(line: string) {
                    logs.push(JSON.parse(line))
                }
            }
        }
    })
    await server.register(requestTimings, { enabled, projectId: 'test-project' })
    server.addHook('onRequest', async () =>
        measure('auth', async () => {
            await delay(1)
        })
    )
    server.post<{ Body: { fail?: boolean } }>(
        '/action',
        { config: { requestTiming: true } },
        async (request) => {
            await measure('action', async () => {
                countTiming('attempts')
                await delay(1)
                if (request.body.fail) throw Error('secret game state')
            })
            return { ok: true }
        }
    )
    server.get('/other', async () => ({ ok: true }))
    return { server, logs }
}

describe('Cloud Run request timings', () => {
    it('logs one correlated report per request across auth, parsing, and concurrent handlers', async () => {
        const { server, logs } = await fixture()
        try {
            const trace = '1234567890abcdef1234567890abcdef'
            const responses = await Promise.all([
                server.inject({
                    method: 'POST',
                    url: '/action',
                    payload: {},
                    headers: { 'x-cloud-trace-context': `${trace}/42;o=1` }
                }),
                server.inject({
                    method: 'POST',
                    url: '/action',
                    payload: { fail: true },
                    headers: { traceparent: `00-${trace}-1234567890abcdef-01` }
                }),
                server.inject({ method: 'GET', url: '/other' })
            ])
            expect(responses.map((response) => response.statusCode)).toEqual([200, 500, 200])
            const reports = logs.filter((entry) => entry.event === 'request_timing')
            expect(reports).toHaveLength(2)
            for (const report of reports) {
                expect(report).toMatchObject({
                    severity: 'INFO',
                    route: '/action',
                    method: 'POST',
                    outcome: 'response',
                    'logging.googleapis.com/trace': `projects/test-project/traces/${trace}`,
                    counters: { attempts: 1 },
                    spans: [
                        expect.objectContaining({ name: 'auth' }),
                        expect.objectContaining({ name: 'action' })
                    ]
                })
                expect(JSON.stringify(report)).not.toContain('secret game state')
            }
        } finally {
            await server.close()
        }
    })

    it('can be disabled without changing responses', async () => {
        const { server, logs } = await fixture(false)
        try {
            const response = await server.inject({ method: 'POST', url: '/action', payload: {} })
            expect(response.json()).toEqual({ ok: true })
            expect(logs.some((entry) => entry.event === 'request_timing')).toBe(false)
        } finally {
            await server.close()
        }
    })

    it('reports rejected bodies without executing the handler', async () => {
        const { server, logs } = await fixture()
        try {
            const response = await server.inject({
                method: 'POST',
                url: '/action',
                headers: { 'content-type': 'application/json' },
                payload: '{'
            })
            expect(response.statusCode).toBe(400)
            expect(logs.filter((entry) => entry.event === 'request_timing')).toEqual([
                expect.objectContaining({
                    statusCode: 400,
                    counters: {},
                    spans: [expect.objectContaining({ name: 'auth' })]
                })
            ])
        } finally {
            await server.close()
        }
    })
})
