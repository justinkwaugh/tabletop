import { describe, expect, it } from 'vitest'
import {
    emptyBoard,
    HydratedDvonnBoard,
    spaceFromName,
    spaceName,
    type Piece
} from '@tabletop/dvonn'
import { boardDiff } from './boardDiff.js'

const placedAt = { q: 0, r: 0 }
const w: Piece = { playerId: 'w', placedAt }
const b: Piece = { playerId: 'b', placedAt }
const d: Piece = { dvonn: true, placedAt }

function board(stacks: Record<string, Piece[]>): HydratedDvonnBoard {
    const data = emptyBoard()
    for (const space of data.spaces) {
        space.stack = stacks[spaceName(space.coords)] ?? []
    }
    return new HydratedDvonnBoard(data)
}

describe('boardDiff', () => {
    const before = board({ A1: [w], B1: [b, d], E3: [b], F3: [w] })
    const after = board({ B1: [b, d, w] })

    it('reads a move and the stacks it cut off', () => {
        const diff = boardDiff(before, after)
        expect(diff.moved).toMatchObject({ pieces: [w], landingOn: 2, leftBelow: 0 })
        expect(diff.moved?.from).toEqual(spaceFromName('A1'))
        expect(diff.moved?.to).toEqual(spaceFromName('B1'))
        expect(diff.vanished.map((stack) => spaceName(stack.coords))).toEqual(['E3', 'F3'])
        expect(diff.appeared).toEqual([])
    })

    it('reads the same move backwards for its undo', () => {
        const diff = boardDiff(after, before)
        expect(diff.moved).toMatchObject({ pieces: [w], landingOn: 0, leftBelow: 2 })
        expect(diff.moved?.from).toEqual(spaceFromName('B1'))
        expect(diff.moved?.to).toEqual(spaceFromName('A1'))
        expect(diff.appeared.map((stack) => spaceName(stack.coords))).toEqual(['E3', 'F3'])
    })

    it('reads a placement as a stack appearing', () => {
        const diff = boardDiff(board({}), board({ C1: [d] }))
        expect(diff.moved).toBeUndefined()
        expect(diff.appeared.map((stack) => spaceName(stack.coords))).toEqual(['C1'])
    })
})
