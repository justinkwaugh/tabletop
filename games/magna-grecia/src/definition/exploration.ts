import {
    assert,
    shuffle,
    type ExplorationPopulation,
    type GameExploration,
    type RandomFunction
} from '@tabletop/common'
import { ACTION_CARDS, actionCard } from '../components/actionCards.js'
import type { MagnaGreciaProjectedState } from '../model/gameState.js'

const LAYER_SIZE = 4

export class MagnaGreciaGameExploration implements GameExploration<MagnaGreciaProjectedState> {
    createFromCanonicalState(state: MagnaGreciaProjectedState): MagnaGreciaProjectedState {
        return state
    }

    createFromProjectedState({
        state,
        random
    }: ExplorationPopulation<MagnaGreciaProjectedState>): MagnaGreciaProjectedState {
        return { ...state, deck: sampleDeck(state.revealedCardIds, random) }
    }
}

export function sampleDeck(revealed: readonly string[], random: RandomFunction): string[] {
    const unrevealed = ACTION_CARDS.filter((card) => !revealed.includes(card.id))
    shuffle(unrevealed, random)
    const deck = [...revealed]
    while (deck.length < ACTION_CARDS.length) {
        const layerStart = deck.length - (deck.length % LAYER_SIZE)
        const layerBorders = deck.slice(layerStart).map((id) => actionCard(id).border)
        const missing = unrevealed.filter((card) => !layerBorders.includes(card.border))
        const openSlots = LAYER_SIZE - layerBorders.length
        const drawn: string[] = []
        for (const card of missing) {
            if (drawn.length === openSlots) {
                break
            }
            if (!drawn.some((id) => actionCard(id).border === card.border)) {
                drawn.push(card.id)
            }
        }
        assert(drawn.length === openSlots, 'Revealed action cards break the deck layers')
        for (const id of drawn) {
            unrevealed.splice(
                unrevealed.findIndex((card) => card.id === id),
                1
            )
        }
        shuffle(drawn, random)
        deck.push(...drawn)
    }
    return deck
}
