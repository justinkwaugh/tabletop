import { describe, expect, it } from 'vitest'
import type { MarketZone } from '../session/titlePresentation.js'
import { marketValueMark } from './marketColors.js'

const zones: readonly MarketZone[] = [
    { color: 'pink', name: 'Par', description: 'A starting price.' },
    { color: 'brown', name: 'Brown', description: 'No limit.', marksCompanyValue: true },
    {
        color: 'red',
        name: 'Liquidation',
        description: 'Sold off.',
        marksCompanyValue: true,
        fill: { kind: 'solid', color: '#c4433a', ink: '#fff8f0' }
    }
]

describe('marketValueMark', () => {
    it('leaves a company off the market, or in an unmarked zone, unmarked', () => {
        expect(marketValueMark(undefined, zones)).toBeUndefined()
        expect(marketValueMark({ color: 'pink' }, zones)).toBeUndefined()
        expect(marketValueMark({ color: 'white' }, zones)).toBeUndefined()
        expect(marketValueMark({ color: 'brown' }, undefined)).toBeUndefined()
    })

    it('tints a marked zone as the market does, with its dark-mode lightness', () => {
        expect(marketValueMark({ color: 'brown' }, zones)).toEqual({
            style: '--market-color:#a77b52;--market-lightness:0.5',
            title: 'Brown: No limit.'
        })
    })

    it('keeps a solid fill and its ink in both colour schemes', () => {
        expect(marketValueMark({ color: 'red' }, zones)?.style).toBe(
            '--market-color:#c4433a;--market-tint:var(--market-color);--market-tint-ink:#fff8f0'
        )
    })
})
