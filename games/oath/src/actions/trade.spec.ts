import { describe, expect, it } from 'vitest'
import { HydratedTrade, TradeOption, Trade } from './trade.js'
import { CardKind, Suit } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { cardIdsOfKind, registeredCardCount, suitOf } from '../data/cardRegistry.js'
import { buildAction } from '../testing/actions.js'
import { FILLER as ORDER_CARD } from '../testing/cards.js'

const ORDER_ADVISER = 'denizen.order.longbows'
const BEAST_ADVISER = 'denizen.beast.rangers'

function trade(playerId: string, cardId: string, option: TradeOption) {
    return new HydratedTrade(buildAction(Trade, { playerId, cardId, option }))
}

function ready(playerOverrides = {}, stateOverrides = {}) {
    return testState([testPlayer({ siteId: 'c1', secrets: 2, favor: 4, ...playerOverrides })], {
        denizensBySite: { c1: [ORDER_CARD] },
        ...stateOverrides
    })
}

describe('card registry', () => {
    it('loads all 198 denizens and the five Visions', () => {
        expect(cardIdsOfKind(CardKind.Denizen)).toHaveLength(198)
        expect(cardIdsOfKind(CardKind.Vision)).toHaveLength(5)
        expect(registeredCardCount()).toBe(
            198 + 5 + cardIdsOfKind(CardKind.Site).length + cardIdsOfKind(CardKind.Relic).length
        )
    })

    it('resolves a real card to its suit', () => {
        expect(suitOf(ORDER_CARD)).toBe(Suit.Order)
        expect(suitOf(BEAST_ADVISER)).toBe(Suit.Beast)
    })

    it('returns undefined for an unknown card rather than throwing', () => {
        // R-10.14 — a card showing no suit is ignored, so an unknown card never matches.
        expect(suitOf('not-a-card')).toBeUndefined()
    })
})

describe('Trade for favor (R-5.3.2 option a)', () => {
    it('places one secret and gains one favor with no matching advisers', () => {
        const state = ready()
        const action = trade('p1', ORDER_CARD, TradeOption.ForFavor)
        action.apply(state)

        const p = state.getPlayerState('p1')
        expect(p.supply).toBe(6)
        // R-4.3.4 — the Rest refund is computed from this ledger, not the Supply marker.
        expect(p.supplySpentThisTurn).toBe(1)
        expect(p.secrets).toBe(1)
        expect(state.tokensOn(ORDER_CARD)).toEqual({ favor: 0, secrets: 1 })
        expect(p.favor).toBe(5)
        expect(state.favorBank[Suit.Order]).toBe(2)
    })

    it('gains one extra favor per matching faceup adviser', () => {
        const state = ready({
            advisers: [
                { cardId: ORDER_ADVISER, faceUp: true },
                { cardId: BEAST_ADVISER, faceUp: true }
            ]
        })
        const action = trade('p1', ORDER_CARD, TradeOption.ForFavor)
        action.apply(state)

        expect(action.metadata?.matchingAdvisers).toBe(1)
        expect(action.metadata?.favorGained).toBe(2)
    })

    it('ignores facedown advisers even when their card would match', () => {
        // R-5.1.4.II — a facedown adviser has no suit.
        const state = ready({ advisers: [{ cardId: ORDER_ADVISER, faceUp: false }] })
        const action = trade('p1', ORDER_CARD, TradeOption.ForFavor)
        action.apply(state)

        expect(action.metadata?.matchingAdvisers).toBe(0)
        expect(action.metadata?.favorGained).toBe(1)
    })

    it('takes only what the favor bank holds (R-9.3)', () => {
        const state = ready(
            { advisers: [{ cardId: ORDER_ADVISER, faceUp: true }] },
            { favorBank: { ...testState([testPlayer()]).favorBank, [Suit.Order]: 1 } }
        )
        const action = trade('p1', ORDER_CARD, TradeOption.ForFavor)
        action.apply(state)

        expect(action.metadata?.favorGained).toBe(1)
        expect(state.favorBank[Suit.Order]).toBe(0)
    })

    it('refuses when the player has no secret to place', () => {
        const state = ready({ secrets: 0 })
        expect(() => trade('p1', ORDER_CARD, TradeOption.ForFavor).apply(state)).toThrow(
            /requires one secret/
        )
    })
})

describe('Trade for secrets (R-5.3.2 option b)', () => {
    it('places two favor and gains NOTHING without matching advisers', () => {
        const state = ready()
        const action = trade('p1', ORDER_CARD, TradeOption.ForSecrets)
        action.apply(state)

        const p = state.getPlayerState('p1')
        expect(p.favor).toBe(2)
        expect(state.tokensOn(ORDER_CARD)).toEqual({ favor: 2, secrets: 0 })
        expect(action.metadata?.secretsGained).toBe(0)
        expect(p.secrets).toBe(2)
    })

    it('gains one secret per matching faceup adviser, from the shared bank', () => {
        const state = ready({
            advisers: [
                { cardId: ORDER_ADVISER, faceUp: true },
                { cardId: 'denizen.order.keep', faceUp: true }
            ]
        })
        const action = trade('p1', ORDER_CARD, TradeOption.ForSecrets)
        action.apply(state)

        expect(action.metadata?.secretsGained).toBe(2)
        expect(state.getPlayerState('p1').secrets).toBe(4)
    })

    it('is never short of secrets — R-9.3 exempts them from component limits', () => {
        const state = ready({
            advisers: Array.from({ length: 6 }, (_, i) => ({
                cardId: [ORDER_ADVISER, 'denizen.order.keep', ORDER_CARD][i % 3],
                faceUp: true
            }))
        })
        const action = trade('p1', ORDER_CARD, TradeOption.ForSecrets)
        action.apply(state)

        expect(action.metadata?.secretsGained).toBe(6)
        expect(state.getPlayerState('p1').secrets).toBe(8)
    })

    it('refuses when the player has fewer than two favor', () => {
        const state = ready({ favor: 1 })
        expect(() => trade('p1', ORDER_CARD, TradeOption.ForSecrets).apply(state)).toThrow(
            /requires two favor/
        )
    })
})

describe('Trade eligibility (R-5.3.2)', () => {
    it('refuses a card that already holds favor or secrets', () => {
        const state = ready()
        state.cardTokens[ORDER_CARD] = { favor: 1, secrets: 0 }
        expect(() => trade('p1', ORDER_CARD, TradeOption.ForFavor).apply(state)).toThrow(
            /already has favor or secrets/
        )
    })

    it('refuses a card with no suit', () => {
        const state = testState([testPlayer({ siteId: 'c1', secrets: 2, favor: 4 })], {
            denizensBySite: { c1: ['mystery-card'] }
        })
        expect(() => trade('p1', 'mystery-card', TradeOption.ForFavor).apply(state)).toThrow(
            /has no suit/
        )
    })

    it('refuses when Supply is short', () => {
        const state = ready({ supply: 0 })
        expect(() => trade('p1', ORDER_CARD, TradeOption.ForFavor).apply(state)).toThrow(
            /costs 1 Supply/
        )
    })
})
