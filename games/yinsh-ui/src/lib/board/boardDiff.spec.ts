import { describe, expect, it } from 'vitest'
import { HydratedYinshBoard, pointFromName as p, pointName } from '@tabletop/yinsh'
import { boardDiff, ringsReturned, ringsTaken, type Position } from './boardDiff.js'

type Rings = Record<string, [string, number][]>

function board(rings: Rings, markers: Record<string, string[]> = {}) {
    return new HydratedYinshBoard({
        rings: Object.entries(rings).flatMap(([playerId, list]) =>
            list.map(([name, id]) => ({ coords: p(name), playerId, id }))
        ),
        markers: Object.entries(markers).flatMap(([playerId, names]) =>
            names.map((name) => ({ coords: p(name), playerId }))
        )
    })
}

const before = board(
    {
        a: [
            ['F3', 0],
            ['B2', 2]
        ],
        b: [['K8', 1]]
    },
    { b: ['F5', 'F6'] }
)
const after = board(
    {
        a: [
            ['F7', 0],
            ['B2', 2]
        ],
        b: [['K8', 1]]
    },
    { a: ['F3', 'F5', 'F6'] }
)

describe('boardDiff', () => {
    it('reads a move: the ring, the marker left behind and the flips', () => {
        const diff = boardDiff(before, after)
        expect(diff.movedRings).toEqual([{ id: 0, playerId: 'a', from: p('F3'), to: p('F7') }])
        expect(diff.markersCome.map((m) => pointName(m.coords))).toEqual(['F3'])
        expect(diff.flipped.map((m) => [pointName(m.coords), m.toPlayerId]).toSorted()).toEqual([
            ['F5', 'a'],
            ['F6', 'a']
        ])
    })

    it('reads the same move backward for undo', () => {
        const diff = boardDiff(after, before)
        expect(diff.movedRings).toEqual([{ id: 0, playerId: 'a', from: p('F7'), to: p('F3') }])
        expect(diff.markersGone.map((m) => pointName(m.coords))).toEqual(['F3'])
        expect(diff.flipped).toHaveLength(2)
    })

    it('pairs every moved ring by its id across several moves', () => {
        const start = board({ a: [['F3', 0]], b: [['K8', 1]] })
        const end = board({ a: [['F7', 0]], b: [['G8', 1]] })
        expect(boardDiff(start, end).movedRings).toEqual([
            { id: 0, playerId: 'a', from: p('F3'), to: p('F7') },
            { id: 1, playerId: 'b', from: p('K8'), to: p('G8') }
        ])
    })

    it('reads a ring taken off and markers removed', () => {
        const taken = board({ a: [['F7', 0]], b: [['K8', 1]] }, { a: ['F3'] })
        const diff = boardDiff(after, taken)
        expect(diff.movedRings).toEqual([])
        expect(diff.ringsGone.map((r) => pointName(r.coords))).toEqual(['B2'])
        expect(diff.markersGone.map((m) => pointName(m.coords)).toSorted()).toEqual(['F5', 'F6'])
    })
})

// A game state as the ring inference reads it: the board and each player's removed rings.
function position(rings: HydratedYinshBoard, removed: Record<string, number[]>): Position {
    return {
        board: rings,
        players: ['a', 'b'].map((playerId) => ({
            playerId,
            removedRingIds: removed[playerId] ?? []
        }))
    }
}

describe('the ring inference undo and history use', () => {
    const onBoard = position(after, { b: [3] })
    const taken = position(board({ a: [['F7', 0]], b: [['K8', 1]] }, { a: ['F3'] }), {
        a: [2],
        b: [3]
    })

    it("finds the ring taken off to its player's spaces", () => {
        const [entry] = ringsTaken(onBoard, taken)
        expect(entry.ring.coords).toEqual(p('B2'))
        expect(entry.slot).toBe(0)
        expect(ringsReturned(onBoard, taken)).toEqual([])
    })

    it('finds the same ring coming back when the removal is undone', () => {
        const [entry] = ringsReturned(taken, onBoard)
        expect(entry.ring.coords).toEqual(p('B2'))
        expect(entry.slot).toBe(0)
        expect(ringsTaken(taken, onBoard)).toEqual([])
    })

    it('reads a move as neither', () => {
        const moved = position(before, { b: [3] })
        expect(ringsTaken(moved, onBoard)).toEqual([])
        expect(ringsReturned(onBoard, moved)).toEqual([])
    })

    it('reads a placement and its undo as neither', () => {
        const placed = position(board({ a: [['C5', 4]] }), {})
        const empty = position(board({}), {})
        expect(ringsReturned(empty, placed)).toEqual([])
        expect(ringsTaken(placed, empty)).toEqual([])
    })
})
