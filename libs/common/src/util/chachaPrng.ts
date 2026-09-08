import { chacha20 } from '@noble/ciphers/chacha.js'
import { hexToBytes } from '@noble/ciphers/utils.js'
import { assert } from './assertions.js'
import type { RandomFunction } from './prng.js'

export function getChaChaPrng(seed: string, invocations: number): RandomFunction {
    const key = hexToBytes(seed)
    const nonce = new Uint8Array(12)
    const zeroes = new Uint8Array(64)
    const block = new Uint8Array(64)
    const view = new DataView(block.buffer)
    let cachedBlock = -1
    let position = invocations
    assert(key.length === 32, 'ChaCha20 requires a 256-bit seed')
    assert(Number.isSafeInteger(position) && position >= 0, 'Invalid PRNG position')
    return () => {
        const blockIndex = Math.floor(position / 16)
        assert(blockIndex < 0xffffffff, 'ChaCha20 stream exhausted')
        if (blockIndex !== cachedBlock) {
            chacha20(key, nonce, zeroes, block, blockIndex)
            cachedBlock = blockIndex
        }
        const value = view.getUint32((position % 16) * 4, true) / 4294967296
        position += 1
        return value
    }
}
