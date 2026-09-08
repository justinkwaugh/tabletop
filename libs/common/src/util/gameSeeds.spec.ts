import { describe, expect, it } from 'vitest'
import { deriveGameSeeds, generateMasterSeed, normalizeMasterSeed } from './gameSeeds.js'
import { getPrng } from './prng.js'
import { getChaChaPrng } from './chachaPrng.js'
import { Prng, RandomState } from '../game/components/prng.js'
import * as Value from 'typebox/value'

const masterSeed = '0123456789abcdef0123456789abcdef'

describe('reproducible game seeds', () => {
    it('derives independent streams using the versioned HKDF protocol', () => {
        expect(deriveGameSeeds(masterSeed)).toEqual({
            publicSeed: 3367980177,
            protectedSeed: '033aacbe6212a2c9bee0cb5c71682e564dd13d1188be676e6f5a533a83f821c3'
        })
        expect(deriveGameSeeds(masterSeed)).toEqual(deriveGameSeeds(masterSeed))
        expect(deriveGameSeeds('1123456789abcdef0123456789abcdef')).not.toEqual(
            deriveGameSeeds(masterSeed)
        )
    })

    it('normalizes copied input and rejects short or malformed seeds', () => {
        expect(normalizeMasterSeed(` ${masterSeed.toUpperCase()} `)).toBe(masterSeed)
        for (const seed of ['1234', 'z'.repeat(32), '0'.repeat(33)]) {
            expect(() => normalizeMasterSeed(seed)).toThrow()
        }
        expect(generateMasterSeed()).toMatch(/^[0-9a-f]{32}$/)
        expect(generateMasterSeed()).not.toBe(generateMasterSeed())
    })
})

describe('persisted random streams', () => {
    it.each([0, 1, 15, 16, 17, 400, 10000])(
        'seeks SplitMix32 to invocation %i without changing its sequence',
        (position) => {
            const sequential = getPrng(8675309)
            for (let i = 0; i < position; i++) sequential()
            const resumed = new Prng({ seed: 8675309, invocations: position })
            expect(Array.from({ length: 32 }, resumed.random)).toEqual(
                Array.from({ length: 32 }, sequential)
            )
        }
    )

    it('pins the legacy SplitMix32 sequence and its full-period wrap', () => {
        const random = getPrng(0)
        expect(Array.from({ length: 4 }, () => random() * 2 ** 32)).toEqual([
            1684164658, 3653269916, 2939563536, 2141751570
        ])
        expect(getPrng(123, 2 ** 32 + 400)()).toBe(getPrng(123, 400)())
    })

    it('matches the RFC 8439 zero-key ChaCha20 block', () => {
        const random = getChaChaPrng('0'.repeat(64), 0)
        const bytes = new Uint8Array(64)
        const view = new DataView(bytes.buffer)
        for (let index = 0; index < 16; index++) view.setUint32(index * 4, random() * 2 ** 32, true)
        expect(Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')).toBe(
            '76b8e0ada0f13d90405d6ae55386bd28bdd219b8a08ded1aa836efcc8b770dc7' +
                'da41597c5157488d7724e03fb8d84a376a43b8f41518a11cc387b669b2ee6586'
        )
    })

    it.each([0, 1, 15, 16, 17, 400, 10000])(
        'resumes ChaCha20 at invocation %i across cached block boundaries',
        (position) => {
            const seed = deriveGameSeeds(masterSeed).protectedSeed
            const state: RandomState = { algorithm: 'chacha20-v1', seed, invocations: 0 }
            const sequential = new Prng(state)
            for (let index = 0; index < position; index++) sequential.random()
            const serialized: unknown = JSON.parse(JSON.stringify(state))
            Value.Assert(RandomState, serialized)
            const resumed = new Prng(serialized)
            expect(Array.from({ length: 40 }, resumed.random)).toEqual(
                Array.from({ length: 40 }, sequential.random)
            )
        }
    )

    it('rejects unknown algorithms and does not advance an exhausted cursor', () => {
        expect(Value.Check(RandomState, { algorithm: 'unknown', seed: 1, invocations: 0 })).toBe(
            false
        )
        const state: RandomState = {
            algorithm: 'chacha20-v1',
            seed: '0'.repeat(64),
            invocations: 0xffffffff * 16
        }
        expect(() => new Prng(state).random()).toThrow('exhausted')
        expect(state.invocations).toBe(0xffffffff * 16)
        expect(() => getChaChaPrng('0'.repeat(64), -1)).toThrow('position')
    })
})
