import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { emptyBoard, ENTRIES, HydratedGipfBoard } from '@tabletop/gipf'
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
