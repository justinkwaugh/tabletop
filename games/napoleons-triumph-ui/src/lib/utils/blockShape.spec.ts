import { describe, expect, it } from 'vitest'
import { BLOCK_LENGTH, BLOCK_THICKNESS, coveredBy } from './blockShape.js'

const lower = { centre: { x: 100, y: 100 }, angle: 0 }
const upper = { centre: { x: 100, y: 100 + BLOCK_THICKNESS * 0.8 }, angle: 0 }

describe('a point covered by blocks', () => {
    it('is covered where any of them lies over it', () => {
        expect(coveredBy([lower, upper])({ x: 100, y: 100 + BLOCK_THICKNESS * 0.45 })).toBe(true)
        expect(coveredBy([lower, upper])({ x: 100, y: 100 - BLOCK_THICKNESS * 0.4 })).toBe(true)
    })

    it('is not covered beside the blocks, or beyond their ends', () => {
        expect(coveredBy([lower, upper])({ x: 100, y: 100 - BLOCK_THICKNESS })).toBe(false)
        expect(coveredBy([lower])({ x: 100 + BLOCK_LENGTH, y: 100 })).toBe(false)
    })

    it('is covered within the margin around a block', () => {
        expect(coveredBy([lower], BLOCK_THICKNESS)({ x: 100, y: 100 - BLOCK_THICKNESS })).toBe(true)
    })

    it('follows a block that is turned', () => {
        const upright = { centre: { x: 0, y: 0 }, angle: 90 }
        expect(coveredBy([upright])({ x: 0, y: BLOCK_LENGTH * 0.4 })).toBe(true)
        expect(coveredBy([upright])({ x: BLOCK_LENGTH * 0.4, y: 0 })).toBe(false)
    })
})
