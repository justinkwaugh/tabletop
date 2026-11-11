import { describe, expect, it } from 'vitest'
import { MIN_FIT_SCALE, fittedSize } from './fitBox.js'

describe('fittedSize', () => {
    it('leaves a panel that fits at full size', () => {
        expect(fittedSize(210, 259.2)).toEqual({ scale: 1, height: 210, scrolls: false })
    })

    it('leaves a panel exactly the budget at full size', () => {
        expect(fittedSize(308, 308)).toEqual({ scale: 1, height: 308, scrolls: false })
    })

    it('scales a panel that outgrows the budget so its box is the budget', () => {
        const { scale, height, scrolls } = fittedSize(320, 259.2)
        expect(scale).toBeCloseTo(0.81)
        expect(height).toBe(260)
        expect(scrolls).toBe(false)
    })

    it('never scales below 0.75: the box stays the budget and scrolls', () => {
        expect(MIN_FIT_SCALE).toBe(0.75)
        expect(fittedSize(920, 333)).toEqual({ scale: 0.75, height: 333, scrolls: true })
    })

    it('scales a panel that fits at 0.75 exactly, without scrolling', () => {
        expect(fittedSize(400, 300)).toEqual({ scale: 0.75, height: 300, scrolls: false })
    })

    it('leaves a fit above 0.75 unchanged', () => {
        const { scale, height, scrolls } = fittedSize(400, 320)
        expect(scale).toBeCloseTo(0.8)
        expect(height).toBe(320)
        expect(scrolls).toBe(false)
    })

    it('follows a changing budget from the same natural height without passing through full size', () => {
        const natural = 346
        const budgets = [341, 330, 319, 308, 297, 308, 319, 330, 341]
        const fits = budgets.map((budget) => fittedSize(natural, budget))
        for (const [index, fit] of fits.entries()) {
            expect(fit.scale).toBeLessThan(1)
            expect(fit.scrolls).toBe(false)
            expect(fit.scale).toBeCloseTo(budgets[index] / natural)
            expect(fit.height - budgets[index]).toBeGreaterThanOrEqual(0)
            expect(fit.height - budgets[index]).toBeLessThanOrEqual(1)
        }
        expect(fittedSize(natural, 308)).toEqual(fits[3])
    })

    it('does nothing before either side is measured', () => {
        expect(fittedSize(0, 259.2)).toEqual({ scale: 1, height: 0, scrolls: false })
        expect(fittedSize(210, 0)).toEqual({ scale: 1, height: 210, scrolls: false })
    })
})
