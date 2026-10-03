import { describe, expect, it } from 'vitest'
import { fittedSize } from './fitBox.js'

describe('fittedSize', () => {
    it('leaves a panel that fits at full size', () => {
        expect(fittedSize(210, 259.2)).toEqual({ scale: 1, height: 210 })
    })

    it('leaves a panel exactly the budget at full size', () => {
        expect(fittedSize(308, 308)).toEqual({ scale: 1, height: 308 })
    })

    it('scales a panel that outgrows the budget so its box is the budget', () => {
        const { scale, height } = fittedSize(360, 259.2)
        expect(scale).toBeCloseTo(0.72)
        expect(height).toBe(260)
    })

    it('follows a changing budget from the same natural height without passing through full size', () => {
        const natural = 346
        const budgets = [341, 330, 319, 308, 297, 308, 319, 330, 341]
        const fits = budgets.map((budget) => fittedSize(natural, budget))
        for (const [index, fit] of fits.entries()) {
            expect(fit.scale).toBeLessThan(1)
            expect(fit.scale).toBeCloseTo(budgets[index] / natural)
            expect(fit.height - budgets[index]).toBeGreaterThanOrEqual(0)
            expect(fit.height - budgets[index]).toBeLessThanOrEqual(1)
        }
        expect(fittedSize(natural, 308)).toEqual(fits[3])
    })

    it('does nothing before either side is measured', () => {
        expect(fittedSize(0, 259.2)).toEqual({ scale: 1, height: 0 })
        expect(fittedSize(210, 0)).toEqual({ scale: 1, height: 210 })
    })
})
