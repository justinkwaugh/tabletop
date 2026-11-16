import { describe, expect, it } from 'vitest'
import { BoardShape } from '@tabletop/matrx'
import { viewOf } from './geometry.js'
import { centreTriangles, gridLines } from './boardLines.js'

describe('gridLines', () => {
    it("draws GIPF's board as seven lines each way, leaving out the rows of dots on its edge", () => {
        expect(gridLines(viewOf(BoardShape.Gipf))).toHaveLength(21)
    })

    it('draws a column for each of B to I on the MATRX board, but none for the dots of A and J', () => {
        const columns = gridLines(viewOf(BoardShape.Matrx)).filter(
            (line) => Math.abs(line.from.x - line.to.x) < 1e-9
        )
        expect(columns).toHaveLength(8)
    })
})

describe('centreTriangles', () => {
    it("joins E5's six neighbours", () => {
        expect(centreTriangles(viewOf(BoardShape.Matrx)).split(' ')).toHaveLength(6)
    })
})
