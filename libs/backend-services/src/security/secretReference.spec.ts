import { describe, expect, it } from 'vitest'
import { concealedCause, secretReference } from './secretReference.js'

const SECRET = 'SYNTHETIC-SESSION-ID-0123456789'

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
    it('replaces the secret everywhere in an error and its causes with the reference', () => {
        const provider = Object.assign(
            new Error(`5 NOT_FOUND: No document to update: sessions/${SECRET}`),
            { code: 5, details: `No document to update: sessions/${SECRET}`, metadata: {} }
        )
        const wrapped = new Error(`Lock for session-${SECRET} was lost`, { cause: provider })
        wrapped.name = 'LockError'

        const concealed = concealedCause(wrapped, [SECRET])

        expect(concealed).toBeInstanceOf(Error)
        expect(errorText(concealed)).not.toContain(SECRET)
        expect(errorText(concealed)).toContain(secretReference(SECRET))
        expect(concealed?.name).toBe('LockError')
        expect(concealed?.message).toBe(`Lock for session-${secretReference(SECRET)} was lost`)
        expect(concealed?.cause).toBeInstanceOf(Error)
        if (!(concealed?.cause instanceof Error)) throw new Error('cause lost')
        expect(concealed.cause.message).toBe(
            `5 NOT_FOUND: No document to update: sessions/${secretReference(SECRET)}`
        )
        expect(Object.entries(concealed.cause)).toEqual([
            ['code', 5],
            ['details', `No document to update: sessions/${secretReference(SECRET)}`],
            ['metadata', {}]
        ])
        expect(concealed.cause.stack).toContain('NOT_FOUND')
        expect(concealed.cause.stack).not.toContain(SECRET)
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
