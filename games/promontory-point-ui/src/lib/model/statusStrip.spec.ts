import { describe, expect, it } from 'vitest'
import { uncoveredRedTileCount, type RailroadId } from '@tabletop/promontory-point'
import { dealtTable } from '$lib/testing/sessionHarness.js'
import { withBagLeft } from '@tabletop/promontory-point/testing'
import { statusStrip } from './statusStrip.js'

const CP: RailroadId = 'railroad.cp'
const KP: RailroadId = 'railroad.kp'

describe('status strip (O-4)', () => {
    it('R-1.2, R-5, R-6.1: the four prices, the bag count and the red tiles uncovered, from data', () => {
        const dealt = dealtTable()
        const state = {
            ...withBagLeft(dealt.state, 1),
            priceIndex: { ...dealt.state.priceIndex, [CP]: 14, [KP]: 2 }
        }
        const strip = statusStrip(state)
        expect(strip.prices.map((price) => price.text)).toEqual([
            'CP $10',
            'UP $5',
            'KP $0',
            'SP $5'
        ])
        const red = uncoveredRedTileCount(state)
        expect(strip.bag).toBe('bag 1')
        expect(strip.redTiles).toBe(`red ${red}`)
        expect(strip.label).toBe(
            `CP $10, UP $5, KP $0, SP $5, 1 piece in the bag, ${red} red tiles uncovered`
        )
    })
})
