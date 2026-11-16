import { describe, expect, it } from 'vitest'
import { ActionSource, type AxialCoordinates } from '@tabletop/common'
import { ActionType, type MoveStack } from '@tabletop/lyngk'
import { boardDiff } from './boardDiff.js'

type Board = [number, number, number[]][]

function state(stacks: Board, scored: number[][] = []) {
    return {
        board: { stacks: stacks.map(([q, r, pieces]) => ({ coords: { q, r }, pieces })) },
        players: [{ scored }, { scored: [] }]
    }
}

const at = (q: number, r: number): AxialCoordinates => ({ q, r })

function move(from: AxialCoordinates, via: AxialCoordinates[], to: AxialCoordinates): MoveStack {
    return {
        id: 'move',
        gameId: 'game',
        source: ActionSource.User,
        type: ActionType.MoveStack,
        playerId: 'a',
        from,
        via,
        to
    }
}

describe('boardDiff', () => {
    it('reads a move as one run onto the stack it lands on, through its LYNGK-points', () => {
        const before = state([
            [0, 0, [1, 2]],
            [0, 2, [3]],
            [1, 1, [4]]
        ])
        const after = state([
            [0, 2, [3, 1, 2]],
            [1, 1, [4]]
        ])
        const diff = boardDiff(before, after, move(at(0, 0), [at(1, 1)], at(0, 2)))
        expect(diff.runs).toEqual([
            {
                pieces: [1, 2],
                start: at(0, 0),
                end: at(0, 2),
                via: [at(1, 1)],
                leftBelow: 0,
                landingOn: 1
            }
        ])
        expect(diff.scored).toEqual([])
        expect(diff.vanished).toEqual([])
        expect(diff.appeared).toEqual([])
    })

    it('takes a move back along its LYNGK-points the other way', () => {
        const before = state([[0, 2, [3, 1, 2]]])
        const after = state([
            [0, 0, [1, 2]],
            [0, 2, [3]]
        ])
        const diff = boardDiff(before, after, move(at(0, 0), [at(1, 1), at(2, 0)], at(0, 2)))
        expect(diff.runs).toEqual([
            {
                pieces: [1, 2],
                start: at(0, 2),
                end: at(0, 0),
                via: [at(2, 0), at(1, 1)],
                leftBelow: 1,
                landingOn: 0
            }
        ])
    })

    it('ends a scoring move on the point its stack is scored on', () => {
        const before = state([
            [0, 0, [1, 2]],
            [0, 1, [3, 4, 5]]
        ])
        const after = state([], [[3, 4, 5, 1, 2]])
        const diff = boardDiff(before, after)
        expect(diff.runs).toMatchObject([{ pieces: [1, 2], start: at(0, 0), end: at(0, 1) }])
        expect(diff.runs[0].landingOn).toBe(3)
        expect(diff.scored).toEqual([{ coords: at(0, 1), pieces: [3, 4, 5, 1, 2] }])
        expect(diff.vanished).toEqual([])
    })

    it('puts a scored stack back: its base drops in and the rest hops home off it', () => {
        const before = state([], [[3, 4, 5, 1, 2]])
        const after = state([
            [0, 0, [1, 2]],
            [0, 1, [3, 4, 5]]
        ])
        const diff = boardDiff(before, after)
        expect(diff.runs).toMatchObject([
            { pieces: [1, 2], start: at(0, 1), end: at(0, 0), leftBelow: 3, landingOn: 0 }
        ])
        expect(diff.unscored).toEqual([{ coords: at(0, 1), pieces: [3, 4, 5] }])
        expect(diff.appeared).toEqual([])
    })

    it('sends every stack a jump over several moves moves straight to its place', () => {
        const before = state([
            [0, 0, [1]],
            [0, 1, [2]],
            [2, 0, [3]],
            [2, 1, [4]]
        ])
        const after = state([
            [0, 1, [2, 1]],
            [2, 1, [4, 3]]
        ])
        const diff = boardDiff(before, after, move(at(0, 0), [at(1, 0)], at(0, 1)))
        expect(diff.runs.map((run) => [run.pieces, run.via])).toEqual([
            [[1], [at(1, 0)]],
            [[3], []]
        ])
    })
})
