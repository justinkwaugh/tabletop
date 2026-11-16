import { describe, expect, it } from 'vitest'
import { PieceKind, spaceFromName, type Piece, type TzaarBoard } from '@tabletop/tzaar'
import { boardDiff } from './boardDiff.js'

function board(stacks: Record<string, Piece[]>): TzaarBoard {
    return {
        stacks: Object.entries(stacks).map(([name, pieces]) => ({
            coords: spaceFromName(name),
            pieces
        }))
    }
}

const piece = (id: number, playerId: string): Piece => ({ id, playerId, kind: PieceKind.Tott })
const w1 = piece(1, 'w')
const w2 = piece(2, 'w')
const w3 = piece(3, 'w')
const b1 = piece(4, 'b')

describe('boardDiff', () => {
    it('reads a capture: the stack moves onto the space and the one there leaves', () => {
        const diff = boardDiff(board({ A1: [w1], A3: [b1] }), board({ A3: [w1] }))
        expect(diff.runs).toEqual([
            {
                pieces: [w1],
                start: spaceFromName('A1'),
                end: spaceFromName('A3'),
                leftBelow: 0,
                landingOn: 0
            }
        ])
        expect(diff.vanished).toEqual([{ coords: spaceFromName('A3'), pieces: [b1] }])
        expect(diff.appeared).toEqual([])
    })

    it('reads a stacking onto the player’s own stack', () => {
        const diff = boardDiff(board({ A1: [w1], A2: [w2] }), board({ A2: [w2, w1] }))
        expect(diff.runs).toMatchObject([{ pieces: [w1], landingOn: 1, leftBelow: 0 }])
        expect(diff.vanished).toEqual([])
    })

    it('reads an undone capture backwards, the captured stack coming back', () => {
        const diff = boardDiff(board({ A3: [w1] }), board({ A1: [w1], A3: [b1] }))
        expect(diff.runs).toMatchObject([
            { start: spaceFromName('A3'), end: spaceFromName('A1'), landingOn: 0 }
        ])
        expect(diff.appeared).toEqual([{ coords: spaceFromName('A3'), pieces: [b1] }])
    })

    it('reads an undone stacking backwards, leaving the stack below', () => {
        const diff = boardDiff(board({ A2: [w2, w1] }), board({ A1: [w1], A2: [w2] }))
        expect(diff.runs).toMatchObject([{ pieces: [w1], leftBelow: 1, landingOn: 0 }])
    })

    it('reads a placement as a stack appearing', () => {
        const diff = boardDiff(board({}), board({ E4: [w1] }))
        expect(diff.runs).toEqual([])
        expect(diff.appeared).toHaveLength(1)
    })

    it('reads a capture and a stacking with the same stack as one run, start to end', () => {
        const diff = boardDiff(board({ A1: [w1], A3: [b1], A4: [w3] }), board({ A4: [w3, w1] }))
        expect(diff.runs).toMatchObject([
            { pieces: [w1], start: spaceFromName('A1'), end: spaceFromName('A4'), landingOn: 1 }
        ])
        expect(diff.vanished).toEqual([{ coords: spaceFromName('A3'), pieces: [b1] }])
    })

    it('reads a stack that is landed on and then moves as two runs to one end', () => {
        const diff = boardDiff(board({ A1: [w1], A2: [w2], A4: [b1] }), board({ A4: [w2, w1] }))
        expect(diff.runs).toMatchObject([
            { pieces: [w1], start: spaceFromName('A1'), landingOn: 1 },
            { pieces: [w2], start: spaceFromName('A2'), landingOn: 0 }
        ])
        expect(diff.vanished).toEqual([{ coords: spaceFromName('A4'), pieces: [b1] }])
    })
})
