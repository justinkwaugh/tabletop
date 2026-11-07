import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    ActionType,
    MarbleColor,
    MarbleSource,
    type Capture,
    type PlaceMarble
} from '@tabletop/zertz'
import { sinkingRingsAfter } from './sinkingRings.js'

const base = { gameId: 'game', source: ActionSource.User }

type Claimed = [number, number][]

// A move by playerId: a placement claiming `onPlacing`, then removing `remove`, which cuts off
// `onRemoving`.
function move(
    id: string,
    playerId: string,
    remove?: [number, number],
    onPlacing: Claimed = [],
    onRemoving: Claimed = []
): PlaceMarble {
    const rings = (claimed: Claimed, marble: MarbleColor) =>
        claimed.map(([q, r]) => ({ coords: { q, r }, marble }))
    return {
        ...base,
        id,
        playerId,
        type: ActionType.PlaceMarble,
        color: MarbleColor.White,
        coords: { q: 0, r: 0 },
        ...(remove === undefined ? {} : { remove: { q: remove[0], r: remove[1] } }),
        metadata: {
            source: MarbleSource.Pool,
            claimedOnPlacing: rings(onPlacing, MarbleColor.Grey),
            claimedOnRemoving: rings(onRemoving, MarbleColor.Black)
        }
    }
}

const capture: Capture = {
    ...base,
    id: 'jump',
    playerId: 'p1',
    type: ActionType.Capture,
    from: { q: 0, r: 0 },
    to: { q: 2, r: 0 }
}

describe('sinkingRingsAfter', () => {
    it('is empty before any ring is removed', () => {
        expect(sinkingRingsAfter([move('a', 'p0')])).toEqual([])
    })

    it('keeps a removal sinking through a later turn without one', () => {
        expect(sinkingRingsAfter([move('a', 'p0', [3, 0]), capture])).toEqual([{ q: 3, r: 0 }])
    })

    it('lets go once a later turn removes a ring', () => {
        expect(sinkingRingsAfter([move('a', 'p0', [3, 0]), move('b', 'p1', [-3, 3])])).toEqual([
            { q: -3, r: 3 }
        ])
    })

    it('sinks a group cut off by the removal along with the ring', () => {
        expect(
            sinkingRingsAfter([
                move(
                    'a',
                    'p0',
                    [-2, 2],
                    [],
                    [
                        [-3, 3],
                        [-2, 3]
                    ]
                )
            ])
        ).toEqual([
            { q: -2, r: 2 },
            { q: -3, r: 3 },
            { q: -2, r: 3 }
        ])
    })

    it('sinks a group claimed by filling, then the removed ring', () => {
        expect(
            sinkingRingsAfter([move('a', 'p1', [3, -1]), move('b', 'p0', [3, 0], [[0, 2]])])
        ).toEqual([
            { q: 0, r: 2 },
            { q: 3, r: 0 }
        ])
    })

    it('sinks a group claimed by filling when no ring is left to remove', () => {
        expect(
            sinkingRingsAfter([move('a', 'p1', [3, -1]), move('b', 'p0', undefined, [[0, 2]])])
        ).toEqual([{ q: 0, r: 2 }])
    })
})
