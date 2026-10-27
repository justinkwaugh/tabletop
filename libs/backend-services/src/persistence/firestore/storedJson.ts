import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'
import { countTiming, measureSync } from '../../diagnostics/requestTimings.js'

// How the game store writes a document's JSON payload: as a text field, or zstd-compressed in a
// bytes field beside it. Readers accept either, so switching encodings never strands a document;
// only a backend from before zstd reading cannot load a compressed one.
export type StoredJsonEncoding = 'json' | 'zstd'

export function storedJsonEncoding(value: string | undefined): StoredJsonEncoding {
    if (value === undefined || value === '' || value === 'json') return 'json'
    if (value === 'zstd') return 'zstd'
    throw new Error(`Unknown stored JSON encoding: ${value}`)
}

// Counts the payload's JSON and stored sizes and times each step under `metric`, so request
// timing logs show what the encoding costs.
export function encodeStoredJson(
    value: unknown,
    encoding: StoredJsonEncoding,
    metric: string
): string | Uint8Array {
    const text = measureSync(`${metric}.stringify`, () => JSON.stringify(value))
    countTiming(`${metric}.jsonBytes`, Buffer.byteLength(text))
    if (encoding === 'json') return text
    const compressed = measureSync(`${metric}.compress`, () => zstdCompressSync(text))
    countTiming(`${metric}.zstdBytes`, compressed.byteLength)
    return compressed
}

export function decodeStoredJson(text: unknown, compressed: unknown, metric: string): unknown {
    if (compressed instanceof Uint8Array) {
        const decompressed = measureSync(`${metric}.decompress`, () =>
            zstdDecompressSync(compressed)
        )
        return JSON.parse(decompressed.toString('utf8'))
    }
    if (typeof text === 'string') return JSON.parse(text)
    return undefined
}
