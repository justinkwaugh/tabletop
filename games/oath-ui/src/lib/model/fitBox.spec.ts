import { describe, expect, it } from 'vitest'
import { fittedSize } from './fitBox.js'

describe('fittedSize', () => {
    it('leaves a panel that fits at full size', () => {
        expect(fittedSize(210, 259.2)).toEqual({ scale: 1, height: 210 })
    })

    it('scales a panel that outgrows the budget so its box is the budget', () => {
        const { scale, height } = fittedSize(360, 259.2)
        expect(scale).toBeCloseTo(0.72)
        expect(height).toBe(260)
    })

    it('does nothing before either side is measured', () => {
        expect(fittedSize(0, 259.2)).toEqual({ scale: 1, height: 0 })
        expect(fittedSize(210, 0)).toEqual({ scale: 1, height: 210 })
    })
})
