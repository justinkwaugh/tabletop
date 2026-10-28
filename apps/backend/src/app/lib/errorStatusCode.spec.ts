import { describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'
import Auth from '@fastify/auth'
import { RecentAuthenticationRequiredError } from '@tabletop/backend-services'
import { errorStatusCode, replyStatusCode } from './errorStatusCode.js'

vi.hoisted(() => {
    vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop')
})

describe('API error status', () => {
    it('preserves framework authorization, validation, and rate-limit failures', () => {
        for (const statusCode of [400, 401, 403, 404, 409, 429, 503]) {
            expect(errorStatusCode(Object.assign(new Error('Rejected'), { statusCode }))).toBe(
                statusCode
            )
        }
    })
    it('reports unexpected failures as server errors', () => {
        for (const failure of [
            undefined,
            new Error('Unexpected'),
            { statusCode: 200 },
            { statusCode: '403' }
        ]) {
            expect(errorStatusCode(failure)).toBe(500)
        }
    })
})

describe('Recent Authentication guard response', () => {
    it('keeps missing proof distinct from a missing session through Fastify auth', async () => {
        const server = Fastify()
        await server.register(Auth)
        server.setErrorHandler((error, _request, reply) => {
            void reply.code(replyStatusCode(error, reply.statusCode))
            return reply.send({
                status: 'error',
                error: { name: error instanceof Error ? error.name : undefined }
            })
        })
        server.get(
            '/proof',
            {
                onRequest: server.auth(
                    [
                        async () => {},
                        async () => {
                            throw new RecentAuthenticationRequiredError()
                        }
                    ],
                    { relation: 'and' }
                )
            },
            async () => ({})
        )
        try {
            const response = await server.inject('/proof')
            expect(response.statusCode).toBe(403)
            expect(response.json()).toMatchObject({
                status: 'error',
                error: { name: 'RecentAuthenticationRequiredError' }
            })
        } finally {
            await server.close()
        }
    })
})

describe('replyStatusCode', () => {
    class Refusal extends Error {
        readonly statusCode = 403
    }

    it("prefers a guard's explicit 4xx over the blanket 401 set before the error handler", () => {
        expect(replyStatusCode(new Refusal('no proof'), 401)).toBe(403)
    })

    it('keeps a status the reply already carries when the error has none', () => {
        expect(replyStatusCode(new Error('plain'), 401)).toBe(401)
    })

    it('derives the status from the error when the reply has none yet', () => {
        expect(replyStatusCode(new Refusal('no proof'), 200)).toBe(403)
        expect(replyStatusCode(new Error('plain'), 200)).toBe(500)
    })
})
