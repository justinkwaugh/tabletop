import { describe, expect, it } from 'vitest'
import { PieceKind, type PlacedPiece } from '@tabletop/punct'
import { boardDiff, isUnchanged } from './boardDiff.js'

function piece(id: number, q: number, rotation = 0, level = 0): PlacedPiece {
    return { id, playerId: 'w', kind: PieceKind.Triangle, punct: { q, r: 0 }, rotation, level }
}

describe('boardDiff', () => {
    it('reads every piece a step brings in, takes away, moves or turns, by id', () => {
        const from = { pieces: [piece(0, 0), piece(1, 2), piece(2, 4), piece(3, -2)] }
        const to = { pieces: [piece(0, 0), piece(1, 3), piece(2, 4, 2), piece(4, 6)] }
        const diff = boardDiff(from, to)
        expect(diff.added.map((added) => added.id)).toEqual([4])
        expect(diff.removed.map((removed) => removed.id)).toEqual([3])
        expect(diff.moved.map(({ was, piece }) => [was.id, piece.punct.q, piece.rotation])).toEqual(
            [
                [1, 3, 0],
                [2, 4, 2]
            ]
        )
    })

    it('finds nothing to do between the same boards', () => {
        const board = { pieces: [piece(0, 0, 0, 1)] }
        expect(isUnchanged(boardDiff(board, { pieces: [piece(0, 0, 0, 1)] }))).toBe(true)
    })
})
