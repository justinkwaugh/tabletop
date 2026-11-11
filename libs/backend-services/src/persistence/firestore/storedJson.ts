import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'
import type { DocumentData } from '@google-cloud/firestore'
import { assert, type GameAction, type GameState } from '@tabletop/common'
import { countTiming, measureSync } from '../../diagnostics/requestTimings.js'

export type StoredJsonEncoding = 'json' | 'zstd'

// Backend 1.47.0 is the oldest release that reads 'zstd'. Never route traffic to an older one (#115).
export const GAME_STORAGE_ENCODING: StoredJsonEncoding = 'zstd'

// A document keeps its payload in one of two fields. Readers accept both so the write encoding
// can change either way; backends from before the zstd field cannot read it.
export class StoredJson<T> {
    constructor(
        private readonly textField: string,
        private readonly zstdField: string,
        private readonly metric: string
    ) {}

    encode(value: T, encoding: StoredJsonEncoding): DocumentData {
        const text = measureSync(`${this.metric}.stringify`, () => JSON.stringify(value))
        countTiming(`${this.metric}.jsonBytes`, Buffer.byteLength(text))
        if (encoding === 'json') return { [this.textField]: text }
        const compressed = measureSync(`${this.metric}.compress`, () => zstdCompressSync(text))
        countTiming(`${this.metric}.zstdBytes`, compressed.byteLength)
        return { [this.zstdField]: compressed }
    }

    decode(document: DocumentData): T {
        const compressed: unknown = document[this.zstdField]
        if (compressed instanceof Uint8Array) {
            const text = measureSync(`${this.metric}.decompress`, () =>
                zstdDecompressSync(compressed).toString('utf8')
            )
            return JSON.parse(text)
        }
        const text: unknown = document[this.textField]
        assert(typeof text === 'string', `${this.metric} document has no ${this.textField}`)
        return JSON.parse(text)
    }
}

export const storedState = new StoredJson<GameState>('data', 'dataZstd', 'store.state')
export const storedActions = new StoredJson<GameAction[]>(
    'actionsData',
    'actionsZstd',
    'store.actionChunk'
)
