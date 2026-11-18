import { describe, expect, it } from 'vitest'
import { ActionSource, coordinatesToNumber } from '@tabletop/common'
import {
    ActionType,
    MarbleColor,
    MarbleSource,
    type Capture,
    type PlaceMarble
} from '@tabletop/zertz'
import { marbleSeed, marbleSeedsAfter, placementSeed, seedAt } from './marbleSeeds.js'

const base = { gameId: 'game', playerId: 'p1', source: ActionSource.User }

function place(q: number, r: number): PlaceMarble {
    return {
        ...base,
        id: `place ${q} ${r}`,
        type: ActionType.PlaceMarble,
        color: MarbleColor.White,
        coords: { q, r },
        metadata: { source: MarbleSource.Pool, claimedOnPlacing: [], claimedOnRemoving: [] }
    }
}

function jump(from: [number, number], over: [number, number], to: [number, number]): Capture {
    return {
        ...base,
        id: `jump ${from} ${to}`,
        type: ActionType.Capture,
        from: { q: from[0], r: from[1] },
        to: { q: to[0], r: to[1] },
        metadata: {
            jumper: MarbleColor.White,
            over: { q: over[0], r: over[1] },
            captured: MarbleColor.Grey,
            continues: false
        }
    }
}

describe('marbleSeedsAfter', () => {
    it('gives a placed marble the seed its staged marble had', () => {
        const seeds = marbleSeedsAfter([place(0, 0), place(1, 0)])
        expect(seedAt(seeds, { q: 1, r: 0 })).toBe(placementSeed({ q: 1, r: 0 }, 1))
    })

    it('carries a jumper its own seed to where it lands', () => {
        const actions = [place(0, 0), place(1, 0), jump([0, 0], [1, 0], [2, 0])]
        const seeds = marbleSeedsAfter(actions)
        expect(seedAt(seeds, { q: 2, r: 0 })).toBe(placementSeed({ q: 0, r: 0 }, 0))
        expect(seeds.has(coordinatesToNumber({ q: 0, r: 0 }))).toBe(false)
        expect(seeds.has(coordinatesToNumber({ q: 1, r: 0 }))).toBe(false)
    })

    it('gives two marbles placed on one ring at different times different seeds', () => {
        const actions = [place(0, 0), place(1, 0), jump([0, 0], [1, 0], [2, 0]), place(0, 0)]
        const seeds = marbleSeedsAfter(actions)
        expect(seedAt(seeds, { q: 0, r: 0 })).not.toBe(seedAt(seeds, { q: 2, r: 0 }))
    })

    it("lets a scenario's starting marble keep its ring's seed through a jump", () => {
        const seeds = marbleSeedsAfter([jump([0, 0], [1, 0], [2, 0])])
        expect(seedAt(seeds, { q: 2, r: 0 })).toBe(coordinatesToNumber({ q: 0, r: 0 }))
        expect(seedAt(seeds, { q: 3, r: 0 })).toBe(coordinatesToNumber({ q: 3, r: 0 }))
    })

    // A hosted game can open with only its latest actions, which still carry their own numbers.
    it('seeds a marble by its action number when the history starts part way through', () => {
        const actions = [
            { ...place(0, 0), index: 7 },
            { ...place(1, 0), index: 8 }
        ]
        const seeds = marbleSeedsAfter(actions)
        expect(seedAt(seeds, { q: 1, r: 0 })).toBe(placementSeed({ q: 1, r: 0 }, 8))
    })

    it('stops before the given action count', () => {
        const actions = [
            { ...place(0, 0), index: 7 },
            { ...place(1, 0), index: 8 }
        ]
        const seeds = marbleSeedsAfter(actions, 8)
        expect(seeds.has(coordinatesToNumber({ q: 1, r: 0 }))).toBe(false)
        expect(seedAt(seeds, { q: 0, r: 0 })).toBe(placementSeed({ q: 0, r: 0 }, 7))
    })
})

describe('marbleSeed', () => {
    const legacy = marbleSeedsAfter([place(0, 0)])

    it('takes the seed the marble carries in the state', () => {
        const ring = { coords: { q: 0, r: 0 }, marble: MarbleColor.Grey, marbleSeed: 42 }
        expect(marbleSeed(ring, legacy)).toBe(42)
    })

    it('reads a marble placed before the state kept seeds from its actions', () => {
        const ring = { coords: { q: 0, r: 0 }, marble: MarbleColor.Grey }
        expect(marbleSeed(ring, legacy)).toBe(placementSeed({ q: 0, r: 0 }, 0))
    })
})
