import { describe, expect, it } from 'vitest'
import { farmLayout } from './farmLayouts.js'

const MIN_FIELD_SIDE = 180

describe('farmLayout', () => {
    it.each([1, 2, 3, 4, 5, 6])('keeps every field on farm %i from being squashed', (farm) => {
        for (const field of farmLayout(farm).fields) {
            expect(Math.min(field.width, field.height)).toBeGreaterThanOrEqual(MIN_FIELD_SIDE)
        }
    })
})
