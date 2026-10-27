import { describe, expect, it } from 'vitest'
import { zstdDecompressSync } from 'node:zlib'
import { StoredJson, storedJsonEncoding } from './storedJson.js'

describe('stored JSON payloads', () => {
    const payload = new StoredJson<{ gameId: string; note: string }>('data', 'dataZstd', 'test')
    const value = { gameId: 'g1', note: 'é' }

    it('writes JSON text or zstd bytes and reads either back', () => {
        const text = payload.encode(value, 'json')
        expect(text).toEqual({ data: JSON.stringify(value) })
        expect(payload.decode(text)).toEqual(value)

        const compressed = payload.encode(value, 'zstd')
        expect(Object.keys(compressed)).toEqual(['dataZstd'])
        expect(zstdDecompressSync(compressed.dataZstd).toString('utf8')).toBe(JSON.stringify(value))
        expect(payload.decode(compressed)).toEqual(value)
    })

    it('prefers the compressed payload and rejects a document with neither', () => {
        const compressed = payload.encode(value, 'zstd')
        expect(payload.decode({ data: '{"stale":true}', ...compressed })).toEqual(value)
        expect(() => payload.decode({})).toThrow('test document has no data')
    })

    it('parses the configured encoding, defaulting to JSON', () => {
        expect(storedJsonEncoding(undefined)).toBe('json')
        expect(storedJsonEncoding('')).toBe('json')
        expect(storedJsonEncoding('json')).toBe('json')
        expect(storedJsonEncoding('zstd')).toBe('zstd')
        expect(() => storedJsonEncoding('gzip')).toThrow('Unknown stored JSON encoding')
    })
})
