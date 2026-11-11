import { describe, expect, it } from 'vitest'
import { mergedPar, mergedPrice } from './mergers.js'
import { dividendSteps } from './operating.js'
import { nonCharteredPar } from './companyRules.js'
import { ignoredSales } from './stockMarket.js'

describe('1862 market movements', () => {
    it('moves right once per multiple of the price paid, up to four, and left on nothing', () => {
        expect(dividendSteps(0, 82)).toBe(-1)
        expect(dividendSteps(60, 82)).toBe(0)
        expect(dividendSteps(90, 82)).toBe(1)
        expect(dividendSteps(170, 82)).toBe(2)
        expect(dividendSteps(1000, 82)).toBe(4)
    })

    it('ignores a non-director’s first sale or two in the outer zones', () => {
        expect(ignoredSales(100)).toBe(0)
        expect(ignoredSales(210)).toBe(1)
        expect(ignoredSales(36)).toBe(1)
        expect(ignoredSales(430)).toBe(2)
    })

    it('sets a non-chartered par at or below the price, at most £100', () => {
        expect(nonCharteredPar(150)).toBe(100)
        expect(nonCharteredPar(71)).toBe(71)
    })

    it('rounds a merged price down to a market price and its par down to a par space (§7.5.3–4)', () => {
        expect(mergedPar(86, true)).toBe(82)
        expect(mergedPar(134, true)).toBe(100)
        expect(mergedPar(40, false)).toBe(54)
    })

    it('exports mergedPrice', () => {
        expect(typeof mergedPrice).toBe('function')
    })
})
