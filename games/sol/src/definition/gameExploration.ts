import {
    Prng,
    assert,
    assertExists,
    type ExplorationPopulation,
    type GameExploration
} from '@tabletop/common'
import { HydratedSolGameState, SolGameState } from '../model/gameState.js'
import { Suit } from '../components/cards.js'
import { HydratedDeck } from '../components/deck.js'
import { isDrawCards } from '../actions/drawCards.js'

export class SolGameExploration implements GameExploration<SolGameState> {
    createFromCanonicalState(state: SolGameState): SolGameState {
        const hydratedState = new HydratedSolGameState(state)
        hydratedState.deck.shuffle()
        return hydratedState.dehydrate()
    }

    createFromProjectedState({
        state,
        actions,
        random
    }: ExplorationPopulation<SolGameState>): SolGameState {
        const suits = Object.values(Suit).filter((suit) => state.effects[suit] !== undefined)
        const prng = new Prng({ seed: Math.floor(random() * 2 ** 32), invocations: 0 })
        const deck = HydratedDeck.create(suits, prng, random)
        const revealedIds = new Set<string>()
        for (const action of actions) {
            if (!isDrawCards(action)) continue
            assertExists(action.metadata, 'Exploration requires the revealed draw outcomes')
            for (const card of action.metadata.drawnCards) {
                assert(!revealedIds.has(card.id), 'Exploration contains a repeated card draw')
                revealedIds.add(card.id)
                const index = deck.items.findIndex((candidate) => candidate.suit === card.suit)
                assert(index >= 0, 'Revealed draws exceed the starting card population')
                deck.items.splice(index, 1)
            }
        }
        assert(
            deck.items.length === state.deck.remaining,
            'Exploration card count does not match the source'
        )
        for (const card of deck.items) {
            while (revealedIds.has(card.id)) card.id = prng.randId()
            revealedIds.add(card.id)
        }
        deck.remaining = deck.items.length
        deck.shuffle(random)
        return { ...state, deck: deck.dehydrate() }
    }
}
