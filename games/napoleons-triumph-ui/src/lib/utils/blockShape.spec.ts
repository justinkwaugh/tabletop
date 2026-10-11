import { describe, expect, it } from 'vitest'
import { BLOCK_LENGTH, BLOCK_THICKNESS, coveredBy, topmostAt } from './blockShape.js'

const lower = { centre: { x: 100, y: 100 }, angle: 0 }
const upper = { centre: { x: 100, y: 100 + BLOCK_THICKNESS * 0.8 }, angle: 0 }

describe('the block a tap falls on', () => {
    it('is the one drawn last where two overlap', () => {
        const where = { x: 100, y: 100 + BLOCK_THICKNESS * 0.45 }
        expect(coveredBy([lower])(where)).toBe(true)
        expect(topmostAt([lower, upper], where)).toBe(upper)
        expect(topmostAt([upper, lower], where)).toBe(lower)
    })

    it('is the only one under the point where they do not', () => {
        expect(topmostAt([lower, upper], { x: 100, y: 100 - BLOCK_THICKNESS * 0.4 })).toBe(lower)
    })

    it('is none beside the blocks, or beyond their ends', () => {
        expect(topmostAt([lower, upper], { x: 100, y: 100 - BLOCK_THICKNESS })).toBeUndefined()
        expect(topmostAt([lower], { x: 100 + BLOCK_LENGTH, y: 100 })).toBeUndefined()
    })

    it('follows a block that is turned', () => {
        const upright = { centre: { x: 0, y: 0 }, angle: 90 }
        expect(topmostAt([upright], { x: 0, y: BLOCK_LENGTH * 0.4 })).toBe(upright)
        expect(topmostAt([upright], { x: BLOCK_LENGTH * 0.4, y: 0 })).toBeUndefined()
    })
})
