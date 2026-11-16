import { describe, expect, it } from 'vitest'
import { TURNED_VIEW, VIEW } from './geometry.js'
import { gridLines } from './boardLines.js'

describe('gridLines', () => {
    it("draws GIPF's board as seven lines each way, leaving out the rows of dots on its edge", () => {
        expect(gridLines(VIEW)).toHaveLength(21)
        expect(gridLines(TURNED_VIEW)).toHaveLength(21)
    })
})
