import { describe, expect, it } from 'vitest'
import { emptyBoard, HydratedYinshBoard, pointFromName as p, pointName } from '@tabletop/yinsh'
import { boardDiff, ringReturned, ringTaken, type Position } from './boardDiff.js'

function board(rings: Record<string, string[]>, markers: Record<string, string[]> = {}) {
    const data = emptyBoard()
    for (const [kind, entries] of [
        ['ringPlayerId', rings],
        ['markerPlayerId', markers]
    ] as const) {
        for (const [playerId, names] of Object.entries(entries)) {
            for (const name of names) {
                const point = data.points.find((candidate) => pointName(candidate.coords) === name)
                if (point) point[kind] = playerId
            }
        }
    }
    return new HydratedYinshBoard(data)
}

const before = board({ a: ['F3', 'B2'], b: ['K8'] }, { b: ['F5', 'F6'] })
const after = board({ a: ['F7', 'B2'], b: ['K8'] }, { a: ['F3', 'F5', 'F6'] })

describe('boardDiff', () => {
    it('reads a move: the ring, the marker left behind and the flips', () => {
        const diff = boardDiff(before, after)
        expect(diff.movedRing).toEqual({ playerId: 'a', from: p('F3'), to: p('F7') })
        expect(diff.markersCome.map((m) => pointName(m.coords))).toEqual(['F3'])
        expect(diff.flipped.map((m) => [pointName(m.coords), m.toPlayerId]).toSorted()).toEqual([
            ['F5', 'a'],
            ['F6', 'a']
        ])
    })

    it('reads the same move backward for undo', () => {
        const diff = boardDiff(after, before)
        expect(diff.movedRing).toEqual({ playerId: 'a', from: p('F7'), to: p('F3') })
        expect(diff.markersGone.map((m) => pointName(m.coords))).toEqual(['F3'])
        expect(diff.flipped).toHaveLength(2)
    })

    it('reads a ring taken off and markers removed', () => {
        const taken = board({ a: ['F7'], b: ['K8'] }, { a: ['F3'] })
        const diff = boardDiff(after, taken)
        expect(diff.movedRing).toBeUndefined()
        expect(diff.ringsGone.map((r) => pointName(r.coords))).toEqual(['B2'])
        expect(diff.markersGone.map((m) => pointName(m.coords)).toSorted()).toEqual(['F5', 'F6'])
    })
})

// A game state as the ring inference reads it: the board and each player's removed rings.
function position(rings: HydratedYinshBoard, removed: Record<string, number>): Position {
    return {
        board: rings,
        getPlayerState: (playerId) => ({ ringsRemoved: removed[playerId] ?? 0 })
    }
}

describe('the ring inference undo and history use', () => {
    const onBoard = position(after, { a: 0, b: 1 })
    const taken = position(board({ a: ['F7'], b: ['K8'] }, { a: ['F3'] }), { a: 1, b: 1 })

    it("finds the ring taken off to its player's spaces", () => {
        expect(ringTaken(onBoard, taken)).toEqual({ coords: p('B2'), playerId: 'a' })
        expect(ringReturned(onBoard, taken)).toBeUndefined()
    })

    it('finds the same ring coming back when the removal is undone', () => {
        expect(ringReturned(taken, onBoard)).toEqual({ coords: p('B2'), playerId: 'a' })
        expect(ringTaken(taken, onBoard)).toBeUndefined()
    })

    it('reads a move as neither', () => {
        const moved = position(before, { a: 0, b: 1 })
        expect(ringTaken(moved, onBoard)).toBeUndefined()
        expect(ringReturned(onBoard, moved)).toBeUndefined()
    })

    it('reads a placement and its undo as neither', () => {
        const placed = position(board({ a: ['F3', 'B2', 'C5'], b: ['K8'] }), { a: 0, b: 1 })
        const empty = position(board({ a: ['F3', 'B2'], b: ['K8'] }), { a: 0, b: 1 })
        expect(ringReturned(empty, placed)).toBeUndefined()
        expect(ringTaken(placed, empty)).toBeUndefined()
    })
})
