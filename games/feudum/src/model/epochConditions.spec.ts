import { describe, expect, it } from 'vitest'
import { RegionIds, type RegionId, type TileId } from '../data/regionTiles.js'
import type { Epoch } from '../data/tracks.js'
import { epochAt, initialState } from '../testing/state.js'
import { epochConditionMet, triggeredEpoch } from './epochConditions.js'
import { sunray } from './tracks.js'

const Numerals = { 1: 'i', 2: 'ii', 3: 'iii', 4: 'iv' } as const

/** One entry per region, left to right: the epoch of its top tile, or 'V' for an empty stack. */
function withTops(epoch: Epoch, tops: readonly (1 | 2 | 3 | 4 | 'V')[]) {
    const state = initialState()
    state.epoch = epochAt(epoch)
    RegionIds.forEach((region: RegionId, index) => {
        const top = tops[index]
        const tileId: TileId | undefined =
            top === 'V' ? undefined : `tile.${region}.${Numerals[top]}`
        state.regionStacks[region] = tileId ? [tileId] : []
    })
    return state
}

describe('R-4.11.2 the condition for the next epoch', () => {
    it.each([
        { epoch: 1, tops: [1, 1, 1, 1, 1, 1], next: undefined },
        { epoch: 1, tops: [2, 2, 2, 1, 1, 1], next: undefined },
        { epoch: 1, tops: [2, 2, 2, 2, 1, 1], next: 2 },
        { epoch: 1, tops: [2, 2, 2, 2, 2, 2], next: 2 },
        { epoch: 2, tops: [2, 2, 2, 2, 1, 1], next: undefined },
        { epoch: 2, tops: [3, 3, 2, 2, 2, 2], next: undefined },
        { epoch: 2, tops: [3, 3, 3, 2, 2, 2], next: 3 },
        { epoch: 3, tops: [3, 3, 3, 3, 3, 4], next: undefined },
        { epoch: 3, tops: [4, 4, 3, 3, 3, 3], next: 4 },
        { epoch: 3, tops: [4, 4, 4, 4, 4, 4], next: 4 },
        { epoch: 4, tops: [4, 4, 4, 4, 4, 4], next: undefined },
        { epoch: 4, tops: [4, 4, 4, 4, 4, 'V'], next: 5 },
        { epoch: 4, tops: ['V', 'V', 4, 4, 4, 4], next: 5 },
        { epoch: 5, tops: ['V', 4, 4, 4, 4, 4], next: undefined }
    ] as const)('in epoch $epoch, tops $tops: $next', ({ epoch, tops, next }) => {
        expect(triggeredEpoch(withTops(epoch, tops))?.epoch).toBe(next)
    })

    it('counts only tiles of that epoch', () => {
        const state = withTops(1, [3, 3, 3, 3, 1, 1])
        expect(epochConditionMet(state, sunray(epochAt(2)))).toBe(false)
        expect(epochConditionMet(state, sunray(epochAt(3)))).toBe(true)
    })

    it('advances one epoch at a time, even when a later condition is also met', () => {
        const state = withTops(1, [2, 2, 2, 2, 3, 3])
        expect(triggeredEpoch(state)?.id).toBe('track.epoch.ii')
        const skipping = withTops(1, [3, 3, 3, 1, 1, 1])
        expect(epochConditionMet(skipping, sunray(epochAt(3)))).toBe(true)
        expect(triggeredEpoch(skipping)).toBeUndefined()
    })

    it('no condition starts epoch I', () => {
        expect(epochConditionMet(withTops(1, [1, 1, 1, 1, 1, 1]), sunray(epochAt(1)))).toBe(false)
    })
})
