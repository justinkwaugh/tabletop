import { describe, expect, it } from 'vitest'
import { REDACTED, concealedCause, secretReference } from './secretReference.js'

const SECRET = 'SYNTHETIC-SESSION-ID-0123456789'
const SHORT_CODE = 'AbC456'

function errorText(error: Error | undefined): string {
    if (!error) return ''
    const own = JSON.stringify(Object.fromEntries(Object.entries(error)))
    const cause = error.cause instanceof Error ? errorText(error.cause) : String(error.cause ?? '')
    return [error.name, error.message, error.stack ?? '', own, cause].join('\n')
}

describe('secretReference', () => {
    it('is a stable digest that does not contain the secret', () => {
        const reference = secretReference(SECRET)
        expect(reference).toBe(secretReference(SECRET))
        expect(reference).not.toContain(SECRET)
        expect(reference).not.toBe(secretReference(`${SECRET}x`))
        expect(reference).toMatch(/^[A-Za-z0-9_-]{43}$/)
    })
})

describe('concealedCause', () => {
    it('replaces the secret everywhere in an error and its causes with the redaction marker', () => {
        const provider = Object.assign(
            new Error(`5 NOT_FOUND: No document to update: sessions/${SECRET}`),
            { code: 5, details: `No document to update: sessions/${SECRET}`, metadata: {} }
        )
        const wrapped = new Error(`Lock for session-${SECRET} was lost`, { cause: provider })
        wrapped.name = 'LockError'

        const concealed = concealedCause(wrapped, [SECRET])

        expect(concealed).toBeInstanceOf(Error)
        expect(errorText(concealed)).not.toContain(SECRET)
        expect(errorText(concealed)).not.toContain(secretReference(SECRET))
        expect(concealed?.name).toBe('LockError')
        expect(concealed?.message).toBe(`Lock for session-${REDACTED} was lost`)
        expect(concealed?.cause).toBeInstanceOf(Error)
        if (!(concealed?.cause instanceof Error)) throw new Error('cause lost')
        expect(concealed.cause.message).toBe(
            `5 NOT_FOUND: No document to update: sessions/${REDACTED}`
        )
        expect(Object.entries(concealed.cause)).toEqual([
            ['code', 5],
            ['details', `No document to update: sessions/${REDACTED}`],
            ['metadata', {}]
        ])
        expect(concealed.cause.stack).toContain('NOT_FOUND')
        expect(concealed.cause.stack).not.toContain(SECRET)
    })

    it('redacts a short code outright instead of naming a digest that could verify it', () => {
        const failure = Object.assign(new Error(`Resend rejected code ${SHORT_CODE}`), {
            response: { body: { code: SHORT_CODE, encoded: encodeURIComponent(`${SHORT_CODE}/`) } }
        })

        const concealed = concealedCause(failure, [SHORT_CODE, `${SHORT_CODE}/`])

        expect(errorText(concealed)).not.toContain(SHORT_CODE)
        expect(errorText(concealed)).not.toContain(secretReference(SHORT_CODE))
        expect(concealed?.message).toBe(`Resend rejected code ${REDACTED}`)
        expect(Object.entries(concealed ?? {})).toEqual([
            ['response', { body: { code: REDACTED, encoded: REDACTED } }]
        ])
    })

    it('conceals custom response classes, nested causes and binary payloads without mutating them', () => {
        class ProviderResponse {
            constructor(
                readonly details: string,
                readonly headers: Map<string, string>,
                readonly raw: Uint8Array
            ) {}
        }
        const response = new ProviderResponse(
            `provider quoted ${SHORT_CODE}`,
            new Map([['x-request-id', 'req-1']]),
            new TextEncoder().encode(SHORT_CODE)
        )
        const socket = Object.assign(new Error(`socket closed while sending ${SHORT_CODE}`), {
            address: { host: 'api.test', path: `/send/${SHORT_CODE}` }
        })
        const failure = Object.assign(new Error('Delivery failed'), {
            response,
            cause: socket,
            at: new Date('2026-10-27T12:00:00.000Z')
        })

        const concealed = concealedCause(failure, [SHORT_CODE])

        expect(errorText(concealed)).not.toContain(SHORT_CODE)
        expect(Object.entries(concealed ?? {})).toEqual([
            ['response', { details: `provider quoted ${REDACTED}`, headers: {}, raw: '[binary]' }],
            ['at', new Date('2026-10-27T12:00:00.000Z')]
        ])
        if (!(concealed?.cause instanceof Error)) throw new Error('cause lost')
        expect(concealed.cause.message).toBe(`socket closed while sending ${REDACTED}`)
        expect(Object.entries(concealed.cause)).toEqual([
            ['address', { host: 'api.test', path: `/send/${REDACTED}` }]
        ])
        expect(failure.message).toBe('Delivery failed')
        expect(response.details).toBe(`provider quoted ${SHORT_CODE}`)
        expect(socket.message).toBe(`socket closed while sending ${SHORT_CODE}`)
        expect(socket.address.path).toBe(`/send/${SHORT_CODE}`)
        expect(failure.response).toBe(response)
    })

    it('leaves the original error untouched and tolerates non-errors and cycles', () => {
        const original = new Error(`token ${SECRET}`)
        const loop: Record<string, unknown> = { secret: SECRET }
        loop.self = loop
        Object.assign(original, { loop })

        const concealed = concealedCause(original, [SECRET, ''])

        expect(original.message).toBe(`token ${SECRET}`)
        expect(errorText(concealed)).not.toContain(SECRET)
        expect(concealedCause('not an error', [SECRET])).toBeUndefined()
        expect(concealedCause(undefined, [SECRET])).toBeUndefined()
    })
})
