import { describe, expect, it } from 'vitest'
import { ActionSource, coordinatesToNumber } from '@tabletop/common'
import {
    ActionType,
    MarbleColor,
    MarbleSource,
    type Capture,
    type PlaceMarble
} from '@tabletop/zertz'
import { marbleSeedsAfter, placementSeed, seedAt } from './marbleSeeds.js'

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
        expect(seeds.has('0,0')).toBe(false)
        expect(seeds.has('1,0')).toBe(false)
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
})
