import { describe, expect, it } from 'vitest'
import { errorStatusCode, replyStatusCode } from './errorStatusCode.js'

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

describe('replyStatusCode', () => {
    class Refusal extends Error {
        readonly statusCode = 403
    }

    it("prefers a guard's explicit 4xx over the blanket 401 set before the error handler", () => {
        expect(replyStatusCode(new Refusal('no mode'), 401)).toBe(403)
    })

    it('keeps a status the reply already carries when the error has none', () => {
        expect(replyStatusCode(new Error('plain'), 401)).toBe(401)
    })

    it('derives the status from the error when the reply has none yet', () => {
        expect(replyStatusCode(new Refusal('no mode'), 200)).toBe(403)
        expect(replyStatusCode(new Error('plain'), 200)).toBe(500)
    })
})
