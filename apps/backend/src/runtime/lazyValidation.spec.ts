import Fastify from 'fastify'
import { Type } from 'typebox'
import { afterEach, describe, expect, it } from 'vitest'
import { lazyValidatorCompiler, type AjvCompilerOptions } from './lazyValidation.js'

const ajvOptions: AjvCompilerOptions = { customOptions: { keywords: ['x-marker'] }, plugins: [] }

const Body = Type.Object(
    {
        count: Type.Integer({ minimum: 1 }),
        tags: Type.Array(Type.String()),
        nested: Type.Object({ when: Type.String({ format: 'date-time' }) }, { 'x-marker': true })
    },
    { additionalProperties: false }
)

const servers: ReturnType<typeof Fastify>[] = []
afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()))
})

async function server(lazy: boolean, schema: object = Body) {
    const instance = Fastify({ ajv: ajvOptions })
    if (lazy)
        instance.setValidatorCompiler(
            lazyValidatorCompiler(() => instance.getSchemas(), ajvOptions)
        )
    await instance.register(async (scoped) => {
        scoped.post('/echo', { schema: { body: schema } }, async (request) => request.body)
    })
    servers.push(instance)
    await instance.ready()
    return instance
}

const payloads = [
    { count: 2, tags: ['a'], nested: { when: '2026-10-01T00:00:00Z' } },
    { count: '3', tags: 'single', nested: { when: '2026-10-01T00:00:00Z' } },
    { count: 0, tags: [], nested: { when: '2026-10-01T00:00:00Z' } },
    { count: 1, tags: [], nested: { when: 'not a date' } },
    { count: 1, tags: [], nested: { when: '2026-10-01T00:00:00Z' }, extra: true },
    { tags: [] }
]

describe('lazyValidatorCompiler', () => {
    it('validates, coerces and reports errors exactly like the default compiler', async () => {
        const eager = await server(false)
        const lazy = await server(true)
        for (const payload of payloads) {
            const [expected, actual] = await Promise.all(
                [eager, lazy].map((instance) =>
                    instance.inject({ method: 'POST', url: '/echo', payload })
                )
            )
            expect({ status: actual.statusCode, body: actual.json() }).toEqual({
                status: expected.statusCode,
                body: expected.json()
            })
        }
    })

    it('defers compilation from startup to the route’s first request', async () => {
        const broken = { type: 'object', properties: { count: { type: 'nonsense' } } }
        await expect(server(false, broken)).rejects.toThrow()
        const lazy = await server(true, broken)
        const response = await lazy.inject({ method: 'POST', url: '/echo', payload: {} })
        expect(response.statusCode).toBe(500)
    })
})
