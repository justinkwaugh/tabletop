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

const SEED_SALT = new TextEncoder().encode('tabletop/game-seeds/v1')

function deriveSeedBytes(masterSeed: string, label: string, length: number): Uint8Array {
    const root = hexToBytes(normalizeMasterSeed(masterSeed))
    return hkdf(sha256, root, SEED_SALT, new TextEncoder().encode(label), length)
}

function numericSeed(bytes: Uint8Array): number {
    return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true)
}

export function deriveGameSeeds(masterSeed: string) {
    return {
        publicSeed: numericSeed(deriveSeedBytes(masterSeed, 'public-v1', 4)),
        protectedSeed: bytesToHex(deriveSeedBytes(masterSeed, 'protected-v1', 32))
    }
}

export function deriveStartingPositionSeeds(masterSeed: string, startingPosition: number) {
    const label = (stream: string) => `position-${startingPosition}-${stream}-v1`
    return {
        identitySeed: numericSeed(deriveSeedBytes(masterSeed, label('identity'), 4)),
        rulesSeed: bytesToHex(deriveSeedBytes(masterSeed, label('rules'), 32))
    }
}
