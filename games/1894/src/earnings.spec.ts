import { describe, expect, it } from 'vitest'
import { Definition } from './definition/gameDefinition.js'
import { EighteenNinetyFourEarningsRules } from './earningsRules.js'
import { EighteenNinetyFourMarket } from './stockMarket.js'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { EighteenNinetyFourScenarios } from './scenarios/index.js'

function moveFrom(spaceId: string, paying: boolean) {
    const { state: raw } = exampleGame(EighteenNinetyFourScenarios, 'trading', 3)
    const state = Definition.runtime.hydrator.hydrateState(structuredClone(raw))
    EighteenNinetyFourMarket.placeMarker(state.stockMarket, 'Belge', spaceId)
    const effect = EighteenNinetyFourEarningsRules.marketEffect(state, 'Belge', {
        choice: paying ? 'pay' : 'withhold',
        revenue: 100,
        retained: paying ? 0 : 100,
        baseDividendPerShare: paying ? 10 : 0
    })
    return effect.move?.toMarketSpaceId
}

describe('dividends move the share price (§10.2)', () => {
    it('moves right on a payout and left on none', () => {
        expect(moveFrom('3:5', true)).toBe('3:6')
        expect(moveFrom('3:5', false)).toBe('3:4')
    })
    it('raises a gray-area company paying at its row’s end one space more (§10.1)', () => {
        expect(EighteenNinetyFourMarket.space(moveFrom('9:4', true) ?? '').price).toBe(64)
        expect(EighteenNinetyFourMarket.space(moveFrom('10:4', true) ?? '').price).toBe(60)
    })
})
