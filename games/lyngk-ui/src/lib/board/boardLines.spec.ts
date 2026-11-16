import { describe, expect, it } from 'vitest'
import { boardLines } from './boardLines.js'
import { VIEW } from './geometry.js'

describe('boardLines', () => {
    it('draws each line of the grid once, along all three axes', () => {
        const lines = boardLines(VIEW)
        const keys = lines.map(({ from, to }) => `${from.x},${from.y}>${to.x},${to.y}`)
        expect(new Set(keys).size).toBe(lines.length)
        const directions = new Set(
            lines.map(({ from, to }) => Math.round(Math.atan2(to.y - from.y, to.x - from.x) * 10))
        )
        expect(directions.size).toBe(3)
    })
})
