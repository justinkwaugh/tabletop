import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { ActionType, emptyBoard, ENTRIES, HydratedGipfBoard, type PushPiece } from '@tabletop/gipf'
import { inferPush } from './inferPush.js'

function boardWith(pieces: [number, number, string][]) {
    const board = new HydratedGipfBoard(emptyBoard())
    for (const [q, r, playerId] of pieces) board.place({ q, r }, { playerId, gipf: false })
    return board
}

// Column E from its bottom dot (0,4) up through E2 (0,3), E3 (0,2), E4 (0,1).
const entry = ENTRIES.find((e) => e.dot.q === 0 && e.dot.r === 4 && e.line[0].r === 3)
assertExists(entry)

describe('inferPush', () => {
    const before = boardWith([
        [0, 3, 'b'],
        [0, 2, 'w'],
        [3, -3, 'b']
    ])
    const after = new HydratedGipfBoard(before.dehydrate())
    after.push(entry, { playerId: 'w', gipf: false })

    it('reads a push stepping forward', () => {
        expect(inferPush(before, after)).toMatchObject({
            entry: { dot: { q: 0, r: 4 } },
            shifted: 2,
            piece: { playerId: 'w', gipf: false },
            forward: true
        })
    })

    it('reads the same push stepping back, as for Undo', () => {
        expect(inferPush(after, before)).toMatchObject({ shifted: 2, forward: false })
    })

    it('finds nothing when pieces were taken rather than pushed', () => {
        const taken = new HydratedGipfBoard(before.dehydrate())
        taken.remove({ q: 0, r: 3 })
        taken.remove({ q: 0, r: 2 })
        expect(inferPush(before, taken)).toBeUndefined()
    })
})

describe('inferPush for a piece that moved nothing along', () => {
    // A lone piece on E2 could have come in from E1 or from either dot beside it.
    const before = boardWith([[3, -3, 'b']])
    const after = boardWith([
        [0, 3, 'w'],
        [3, -3, 'b']
    ])
    const pushFrom = (dot: { q: number; r: number }): PushPiece =>
        ({
            id: 'push',
            gameId: 'game',
            playerId: 'w',
            type: ActionType.PushPiece,
            dot,
            to: { q: 0, r: 3 },
            gipf: false
        }) as PushPiece

    it('could read any of the dots beside its spot', () => {
        const dots = ENTRIES.filter((e) => e.line[0].q === 0 && e.line[0].r === 3).map((e) => e.dot)
        expect(dots).toHaveLength(3)
        expect(dots).toContainEqual(inferPush(before, after)?.entry.dot)
    })

    it.each([
        { q: 0, r: 4 },
        { q: 1, r: 3 },
        { q: -1, r: 4 }
    ])('follows the push history steps to, from %o', (dot) => {
        expect(inferPush(before, after, pushFrom(dot))).toMatchObject({
            entry: { dot },
            shifted: 0,
            forward: true
        })
    })

    it('follows the push Undo takes back', () => {
        expect(inferPush(after, before, pushFrom({ q: 1, r: 3 }))).toMatchObject({
            entry: { dot: { q: 1, r: 3 } },
            forward: false
        })
    })

    it('reads the boards when the known push does not fit them', () => {
        const elsewhere = { ...pushFrom({ q: 0, r: 4 }), dot: { q: 4, r: 0 }, to: { q: 3, r: 0 } }
        expect(inferPush(before, after, elsewhere)?.entry.line[0]).toEqual({ q: 0, r: 3 })
    })
})
