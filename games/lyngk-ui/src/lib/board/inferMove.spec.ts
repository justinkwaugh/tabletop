import { describe, expect, it } from 'vitest'
import { emptyBoard, HydratedLyngkBoard, PieceColor } from '@tabletop/lyngk'
import { inferMove } from './inferMove.js'

const { Red: R, Blue: U, Green: G } = PieceColor

function board(stacks: [number, number, PieceColor[]][]) {
    const data = emptyBoard()
    for (const [q, r, stack] of stacks) {
        const point = data.points.find((p) => p.coords.q === q && p.coords.r === r)
        if (point) point.stack = stack
    }
    return new HydratedLyngkBoard(data)
}

const before = board([
    [0, 0, [R, U]],
    [0, 2, [G]],
    [1, 1, [R]]
])
const after = board([
    [0, 2, [G, R, U]],
    [1, 1, [R]]
])

describe('inferMove', () => {
    it('reads a move forward', () => {
        expect(inferMove(before, after)).toEqual({
            from: { q: 0, r: 0 },
            to: { q: 0, r: 2 },
            moved: [R, U],
            landedOn: [G],
            forward: true,
            scored: false
        })
    })

    it('reads the same move undone', () => {
        expect(inferMove(after, before)).toEqual({
            from: { q: 0, r: 0 },
            to: { q: 0, r: 2 },
            moved: [R, U],
            landedOn: [G],
            forward: false,
            scored: false
        })
    })

    it('needs the scored stack to read a move that scored', () => {
        const scoredBoard = board([[1, 1, [R]]])
        expect(inferMove(before, scoredBoard)).toBeUndefined()
        const scored = [G, R, U]
        expect(inferMove(before, scoredBoard, scored)).toMatchObject({
            from: { q: 0, r: 0 },
            to: { q: 0, r: 2 },
            forward: true,
            scored: true
        })
        expect(inferMove(scoredBoard, before, scored)).toMatchObject({
            from: { q: 0, r: 0 },
            to: { q: 0, r: 2 },
            moved: [R, U],
            landedOn: [G],
            forward: false,
            scored: true
        })
    })
})
