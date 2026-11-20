import { describe, expect, it } from 'vitest'
import { BoardShape } from '@tabletop/game-of-y'
import { boardView } from './geometry.js'
import { zoomLimits } from './zoom.js'

describe('zoomLimits', () => {
    it('never draws a board wider than 5,500 device pixels', () => {
        for (const shape of Object.values(BoardShape)) {
            for (const ratio of [1, 2, 3]) {
                const { maxScale, maxFitScale } = zoomLimits(shape, ratio)
                for (const flat of [false, true]) {
                    const { width } = boardView(shape, flat).frame
                    expect(maxScale * width * ratio).toBeLessThanOrEqual(5500)
                }
                expect(maxFitScale).toBeLessThanOrEqual(maxScale)
            }
        }
    })

    it('keeps the full zoom on a 1x screen and caps the large boards on a phone', () => {
        expect(zoomLimits(BoardShape.Kadon, 1)).toEqual({ maxScale: 4, maxFitScale: 2.5 })
        expect(zoomLimits(BoardShape.Hex19, 3).maxScale).toBeCloseTo(1.64, 1)
        expect(zoomLimits(BoardShape.Kadon, 3).maxScale).toBeCloseTo(2.63, 1)
    })
})
