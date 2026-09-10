import { describe, expect, it } from 'vitest'
import { errorStatusCode } from './errorStatusCode.js'

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
