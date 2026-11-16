import { describe, expect, it } from 'vitest'
import { viewOf } from './geometry.js'
import { gridLines } from './boardLines.js'

describe('gridLines', () => {
    it('draws seven lines each way, leaving out the rows of dots on the rim', () => {
        const lines = gridLines(viewOf(false))
        expect(lines).toHaveLength(21)
        const columns = lines.filter((line) => Math.abs(line.from.x - line.to.x) < 1e-9)
        expect(columns).toHaveLength(7)
    })
})
