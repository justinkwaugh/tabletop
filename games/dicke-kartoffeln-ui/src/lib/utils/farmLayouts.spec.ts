import { describe, expect, it } from 'vitest'
import { farmLayout } from './farmLayouts.js'

describe('farmLayout', () => {
    // A field's highlight is drawn from its area and its tokens are sized from the shorter side,
    // so a squashed area shows as a narrow box with undersized worms.
    it.each([1, 2, 3, 4, 5, 6])('gives every field on farm %i a full-size area', (farm) => {
        for (const field of farmLayout(farm).fields) {
            expect(Math.min(field.width, field.height)).toBeGreaterThanOrEqual(180)
        }
    })
})
