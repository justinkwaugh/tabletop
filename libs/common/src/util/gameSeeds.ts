import * as Type from 'typebox'
import * as Value from 'typebox/value'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'

export const MasterSeed = Type.String({ pattern: '^[0-9a-f]{32}$' })
export const GameCreationOptions = Type.Object(
    { masterSeed: Type.Optional(MasterSeed) },
    { additionalProperties: false }
)
export type GameCreationOptions = Type.Static<typeof GameCreationOptions>

export function normalizeMasterSeed(seed: string): string {
    const normalized = seed.trim().toLowerCase()
    Value.Assert(MasterSeed, normalized)
    return normalized
}

export function generateMasterSeed(): string {
    return bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
}

export function deriveGameSeeds(masterSeed: string) {
    const root = hexToBytes(normalizeMasterSeed(masterSeed))
    const encoder = new TextEncoder()
    const salt = encoder.encode('tabletop/game-seeds/v1')
    const publicBytes = hkdf(sha256, root, salt, encoder.encode('public-v1'), 4)
    const privateBytes = hkdf(sha256, root, salt, encoder.encode('protected-v1'), 32)
    return {
        publicSeed: new DataView(publicBytes.buffer, publicBytes.byteOffset, 4).getUint32(0, true),
        protectedSeed: bytesToHex(privateBytes)
    }
}
