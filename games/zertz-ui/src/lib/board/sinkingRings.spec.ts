import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    ActionType,
    MarbleColor,
    MarbleSource,
    type Capture,
    type PlaceMarble,
    type RemoveRing
} from '@tabletop/zertz'
import { sinkingRingsAfter } from './sinkingRings.js'

const base = { gameId: 'game', source: ActionSource.User }

function placement(id: string, playerId: string, claimed: [number, number][] = []): PlaceMarble {
    return {
        ...base,
        id,
        playerId,
        type: ActionType.PlaceMarble,
        color: MarbleColor.White,
        coords: { q: 0, r: 0 },
        metadata: {
            source: MarbleSource.Pool,
            claimedRings: claimed.map(([q, r]) => ({ coords: { q, r }, marble: MarbleColor.Grey }))
        }
    }
}

function removal(
    id: string,
    playerId: string,
    q: number,
    r: number,
    claimed: [number, number][] = []
): RemoveRing {
    return {
        ...base,
        id,
        playerId,
        type: ActionType.RemoveRing,
        coords: { q, r },
        metadata: {
            claimedRings: claimed.map(([cq, cr]) => ({
                coords: { q: cq, r: cr },
                marble: MarbleColor.Black
            }))
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
        expect(sinkingRingsAfter([placement('a', 'p0')])).toEqual([])
    })

    it('keeps a removal sinking through a later turn without one', () => {
        expect(
            sinkingRingsAfter([placement('a', 'p0'), removal('b', 'p0', 3, 0), capture])
        ).toEqual([{ q: 3, r: 0 }])
    })

    it('lets go once a later turn removes a ring', () => {
        expect(
            sinkingRingsAfter([
                placement('a', 'p0'),
                removal('b', 'p0', 3, 0),
                placement('c', 'p1'),
                removal('d', 'p1', -3, 3)
            ])
        ).toEqual([{ q: -3, r: 3 }])
    })

    it('sinks a group cut off by the removal along with the ring', () => {
        expect(
            sinkingRingsAfter([
                removal('a', 'p0', -2, 2, [
                    [-3, 3],
                    [-2, 3]
                ])
            ])
        ).toEqual([
            { q: -2, r: 2 },
            { q: -3, r: 3 },
            { q: -2, r: 3 }
        ])
    })

    it('keeps a claim by filling and the same turn’s removal together', () => {
        expect(
            sinkingRingsAfter([
                removal('a', 'p1', 3, -1),
                placement('b', 'p0', [[0, 2]]),
                removal('c', 'p0', 3, 0)
            ])
        ).toEqual([
            { q: 0, r: 2 },
            { q: 3, r: 0 }
        ])
    })

    it('keeps a claim by filling sinking while the removal is still to come', () => {
        expect(
            sinkingRingsAfter([removal('a', 'p1', 3, -1), placement('b', 'p0', [[0, 2]])])
        ).toEqual([{ q: 0, r: 2 }])
    })
})
