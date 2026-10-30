import { describe, expect, it } from 'vitest'
import {
    emptyBoard,
    HydratedTzaarBoard,
    PieceKind,
    spaceFromName,
    type Piece
} from '@tabletop/tzaar'
import { boardDiff } from './boardDiff.js'

function board(stacks: Record<string, Piece[]>): HydratedTzaarBoard {
    const data = emptyBoard()
    for (const space of data.spaces) {
        for (const [name, pieces] of Object.entries(stacks)) {
            const coords = spaceFromName(name)
            if (coords.q === space.coords.q && coords.r === space.coords.r) space.stack = pieces
        }
    }
    return new HydratedTzaarBoard(data)
}

const piece = (id: number, playerId: string): Piece => ({ id, playerId, kind: PieceKind.Tott })
const w1 = piece(1, 'w')
const w2 = piece(2, 'w')
const b1 = piece(3, 'b')

describe('boardDiff', () => {
    it('reads a capture: the stack moves onto the space and the one there is taken', () => {
        const diff = boardDiff(board({ A1: [w1], A3: [b1] }), board({ A3: [w1] }))
        expect(diff.moved).toMatchObject({
            from: spaceFromName('A1'),
            to: spaceFromName('A3'),
            landingOn: 0,
            captured: [b1],
            forward: true
        })
        expect(diff.vanished).toEqual([])
    })

    it('reads a stacking onto the player’s own stack', () => {
        const diff = boardDiff(board({ A1: [w1], A2: [w2] }), board({ A2: [w2, w1] }))
        expect(diff.moved).toMatchObject({ landingOn: 1, captured: [], forward: true })
    })

    it('reads an undone capture backwards, the captured stack coming back', () => {
        const diff = boardDiff(board({ A3: [w1] }), board({ A1: [w1], A3: [b1] }))
        expect(diff.moved).toMatchObject({
            from: spaceFromName('A3'),
            to: spaceFromName('A1'),
            captured: [b1],
            forward: false
        })
        expect(diff.appeared).toEqual([])
    })

    it('reads an undone stacking backwards, leaving the stack below', () => {
        const diff = boardDiff(board({ A2: [w2, w1] }), board({ A1: [w1], A2: [w2] }))
        expect(diff.moved).toMatchObject({ leftBelow: 1, pieces: [w1], forward: false })
    })

    it('reads a placement as a stack appearing', () => {
        const diff = boardDiff(board({}), board({ E4: [w1] }))
        expect(diff.moved).toBeUndefined()
        expect(diff.appeared).toHaveLength(1)
    })
})
