import { describe, expect, it } from 'vitest'
import { zstdDecompressSync } from 'node:zlib'
import { decodeStoredJson, encodeStoredJson, storedJsonEncoding } from './storedJson.js'

describe('stored JSON encoding', () => {
    const value = { gameId: 'g1', players: ['p1', 'p2'], note: 'é' }

    it('writes JSON text or zstd bytes and reads either back', () => {
        const text = encodeStoredJson(value, 'json', 'test')
        expect(text).toBe(JSON.stringify(value))
        expect(decodeStoredJson(text, undefined, 'test')).toEqual(value)

        const compressed = encodeStoredJson(value, 'zstd', 'test')
        expect(compressed).toBeInstanceOf(Uint8Array)
        expect(zstdDecompressSync(compressed as Uint8Array).toString('utf8')).toBe(
            JSON.stringify(value)
        )
        expect(decodeStoredJson(undefined, compressed, 'test')).toEqual(value)
    })

    it('prefers the compressed payload and reads nothing when neither is present', () => {
        const compressed = encodeStoredJson(value, 'zstd', 'test')
        expect(decodeStoredJson('{"stale":true}', compressed, 'test')).toEqual(value)
        expect(decodeStoredJson(undefined, undefined, 'test')).toBeUndefined()
    })

    it('parses the configured encoding, defaulting to JSON', () => {
        expect(storedJsonEncoding(undefined)).toBe('json')
        expect(storedJsonEncoding('')).toBe('json')
        expect(storedJsonEncoding('json')).toBe('json')
        expect(storedJsonEncoding('zstd')).toBe('zstd')
        expect(() => storedJsonEncoding('gzip')).toThrow('Unknown stored JSON encoding')
    })
})
