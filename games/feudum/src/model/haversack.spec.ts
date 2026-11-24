import { describe, expect, it } from 'vitest'
import type { RandomFunction } from '@tabletop/common'
import { initialState } from '../testing/state.js'
import { drawGood, drawGoods, pickGood } from './haversack.js'
import { goodCounts } from './stateSchemas.js'

function scripted(...values: number[]): RandomFunction {
    return () => {
        const value = values.shift()
        if (value === undefined) throw new Error('the script ran out')
        return value
    }
}

const ChaChaCursor = {
    algorithm: 'chacha20-v1',
    seed: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
    invocations: 0
} as const

function protectedState(cursor: NonNullable<ReturnType<typeof initialState>['protectedPrng']>) {
    const state = initialState()
    state.systemVersion = 3
    state.protectedPrng = { ...cursor }
    return state
}

const GoldenChaCha = ['iron', 'sulfur', 'iron', 'sulfur', 'iron', 'food', 'saltpeter', 'wood']
const GoldenNumeric = ['sulfur', 'wood', 'iron', 'food', 'saltpeter', 'sulfur', 'sulfur', 'wood']

describe('R-5.2 the haversack draw is a weighted pick from the public counts', () => {
    const counts = goodCounts({ saltpeter: 1, sulfur: 2, iron: 3, wood: 0, food: 4 })

    it.each([
        { roll: 0, good: 'saltpeter' },
        { roll: 0.0999, good: 'saltpeter' },
        { roll: 0.1, good: 'sulfur' },
        { roll: 0.2999, good: 'sulfur' },
        { roll: 0.3, good: 'iron' },
        { roll: 0.5999, good: 'iron' },
        { roll: 0.6, good: 'food' },
        { roll: 0.9999, good: 'food' }
    ])('a roll of $roll over 1/2/3/0/4 picks $good', ({ roll, good }) => {
        expect(pickGood(counts, scripted(roll))).toBe(good)
    })

    it('never picks a good the haversack does not hold', () => {
        const onlyWood = goodCounts({ wood: 1 })
        for (const roll of [0, 0.5, 0.9999]) {
            expect(pickGood(onlyWood, scripted(roll))).toBe('wood')
        }
    })

    it('rolls nothing when the haversack is empty', () => {
        expect(pickGood(goodCounts(), scripted())).toBeUndefined()
    })

    it('takes what it picked out of the counts', () => {
        const state = initialState()
        state.supply.haversack = goodCounts({ iron: 2 })
        expect(drawGood(state)).toBe('iron')
        expect(state.supply.haversack).toEqual(goodCounts({ iron: 1 }))
    })

    it('R-1.1-H1 a haversack that runs short gives what remains', () => {
        const state = initialState()
        state.supply.haversack = goodCounts({ wood: 1, food: 1 })
        const drawn = drawGoods(state, 5)
        expect([...drawn].sort()).toEqual(['food', 'wood'])
        expect(state.supply.haversack).toEqual(goodCounts())
    })
})

describe('R-5.2 draws come from the protected stream', () => {
    const start = goodCounts({ saltpeter: 3, sulfur: 3, iron: 3, wood: 3, food: 3 })

    it('moves only the protected cursor, one step per good', () => {
        const state = protectedState(ChaChaCursor)
        state.supply.haversack = { ...start }
        const publicInvocations = state.prng.invocations

        drawGoods(state, 4)

        expect(state.protectedPrng?.invocations).toBe(4)
        expect(state.prng.invocations).toBe(publicInvocations)
    })

    it('consumes the stream only for a good that is drawn', () => {
        const state = protectedState(ChaChaCursor)
        state.supply.haversack = goodCounts({ food: 1 })

        drawGoods(state, 3)

        expect(state.protectedPrng?.invocations).toBe(1)
    })

    it('golden vector on a ChaCha cursor', () => {
        const state = protectedState(ChaChaCursor)
        state.supply.haversack = { ...start }
        expect(drawGoods(state, 8)).toEqual(GoldenChaCha)
    })

    it('golden vector on a numeric cursor', () => {
        const state = protectedState({ seed: 8675309, invocations: 0 })
        state.supply.haversack = { ...start }
        expect(drawGoods(state, 8)).toEqual(GoldenNumeric)
    })

    it('draws the same one good at a time as all at once', () => {
        const together = protectedState(ChaChaCursor)
        together.supply.haversack = { ...start }
        const apart = protectedState(ChaChaCursor)
        apart.supply.haversack = { ...start }

        const singly = Array.from({ length: 8 }, () => drawGood(apart))

        expect(singly).toEqual(drawGoods(together, 8))
    })
})
