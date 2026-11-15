import { describe, expect, it } from 'vitest'
import { CardDeck, CardUnavailable, ScenarioId, TechField } from '@tabletop/stellar-horizons-2'
import { hydrate, startedGame } from '@tabletop/stellar-horizons-2/testing'
import { cardLedger, unavailabilityText } from './cards.js'

function campaign() {
    const state = hydrate(startedGame(2, { scenario: ScenarioId.Campaign }).state)
    const playerId = state.players[0].playerId
    const player = state.getPlayerState(playerId)
    player.cards = [
        { cardId: 'aquatic-species', year: 2100, bought: true },
        { cardId: 'robo-miners', year: 2100, bought: true },
        { cardId: 'pioneers', year: 2100, bought: false }
    ]
    player.hand = [
        { playerId, deck: CardDeck.Genetic, level: 1, cardId: 'gifted-artists' },
        { playerId, deck: CardDeck.Fleet, level: 2, cardId: 'quantum-sensors' }
    ]
    return { state, playerId }
}

describe('card ledger', () => {
    it('orders owned cards and the hand by deck, then level', () => {
        const { state, playerId } = campaign()
        const ledger = cardLedger(state, playerId, true)
        expect(ledger.owned.map((row) => row.cardId)).toEqual([
            'robo-miners',
            'pioneers',
            'aquatic-species'
        ])
        expect(ledger.hand.map((row) => row.cardId)).toEqual(['quantum-sensors', 'gifted-artists'])
        expect(ledger.points).toBe(3 + 1 + 8)
    })

    it('prices a hand card for its holder and says why it cannot be bought', () => {
        const { state, playerId } = campaign()
        state.getPlayerState(playerId).fieldsDeveloped.push(TechField.Biology)
        const [quantum, artists] = cardLedger(state, playerId, true).hand
        expect(quantum.cost).toBe(15)
        expect(quantum.unavailable).toBeUndefined()
        expect(artists.unavailable).toBe(CardUnavailable.TypeBought)
        expect(unavailabilityText('gifted-artists', CardUnavailable.TypeBought)).toBe(
            'A biology tech or card is already bought this turn'
        )
        expect(unavailabilityText('increased-body-size', CardUnavailable.Excluded)).toBe(
            'Cannot be owned with Reduced Body Size'
        )
    })

    it('shows another player only the deck and level of each card in hand', () => {
        const { state, playerId } = campaign()
        expect(cardLedger(state, playerId, false).hand).toEqual([
            { key: 'Fleet-2-1', deck: CardDeck.Fleet, level: 2 },
            { key: 'Genetic-1-0', deck: CardDeck.Genetic, level: 1 }
        ])
    })
})
