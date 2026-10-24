import {
    assert,
    shuffle,
    type ExplorationPopulation,
    type GameExploration,
    type RandomFunction
} from '@tabletop/common'
import { cardDefinition, deckCards, type CardLevel } from '../components/cards.js'
import type { CardDeck } from '../components/cards.js'
import {
    StellarHorizonsGameStateValidator,
    type StellarHorizonsProjectedState
} from '../model/gameState.js'

export class StellarHorizonsGameExploration implements GameExploration<StellarHorizonsProjectedState> {
    createFromCanonicalState(state: StellarHorizonsProjectedState): StellarHorizonsProjectedState {
        return structuredClone(state)
    }

    // Card hands, decks and discards are hidden (campaign plan, slice 4). A Player exploring sees
    // only their own hand, so every other card is sampled from those they have not seen: no card
    // anyone owns, every hand keeping its backs, and no hand holding a copy of a card its Player
    // owns or holds.
    createFromProjectedState({
        state,
        random
    }: ExplorationPopulation<StellarHorizonsProjectedState>): StellarHorizonsProjectedState {
        const sample = structuredClone(state)
        for (const pile of sample.cardPiles) {
            populateDeck(sample, pile.deck, pile.level, random)
        }
        assert(
            StellarHorizonsGameStateValidator.Check(sample),
            'Exploration must produce a complete Stellar Horizons state'
        )
        return sample
    }
}

type ProjectedPlayer = StellarHorizonsProjectedState['players'][number]

// The cards a Player's view shows them: those they own and those in their hand.
function knownCardIds(player: ProjectedPlayer): string[] {
    return [
        ...player.cards.map((card) => card.cardId),
        ...player.hand.flatMap((card) => (card.cardId === undefined ? [] : [card.cardId]))
    ]
}

function populateDeck(
    state: StellarHorizonsProjectedState,
    deck: CardDeck,
    level: CardLevel,
    random: RandomFunction
) {
    const matches = (cardId: string) => {
        const definition = cardDefinition(cardId)
        return definition.deck === deck && definition.level === level
    }
    const unseen = deckCards(deck, level)
    for (const cardId of state.players.flatMap(knownCardIds).filter(matches)) {
        const index = unseen.indexOf(cardId)
        assert(index >= 0, `More copies of ${cardId} are in play than printed`)
        unseen.splice(index, 1)
    }
    shuffle(unseen, random)

    const slots = state.players.flatMap((player) =>
        player.hand
            .filter(
                (card) => card.cardId === undefined && card.deck === deck && card.level === level
            )
            .map((card) => ({ player, card, known: new Set(knownCardIds(player)) }))
    )
    // Each hidden hand card takes an unseen card its Player neither owns nor holds, and no
    // Player gets two copies of one card: a bipartite matching, found by augmenting paths so a
    // deal is found whenever one exists. The shuffle makes it a random one.
    const holder: (number | undefined)[] = unseen.map(() => undefined)
    const fits = (slot: number, index: number) =>
        !slots[slot].known.has(unseen[index]) &&
        !slots.some(
            (other, otherSlot) =>
                otherSlot !== slot &&
                other.player === slots[slot].player &&
                holder.indexOf(otherSlot) >= 0 &&
                unseen[holder.indexOf(otherSlot)] === unseen[index]
        )
    const place = (slot: number, visited: Set<number>): boolean => {
        for (let index = 0; index < unseen.length; index++) {
            if (visited.has(index) || !fits(slot, index)) {
                continue
            }
            visited.add(index)
            const current = holder[index]
            holder[index] = slot
            if (current === undefined || place(current, visited)) {
                return true
            }
            holder[index] = current
        }
        return false
    }
    slots.forEach((_, slot) => {
        assert(place(slot, new Set()), 'No unseen card can fill a hand')
    })
    holder.forEach((slot, index) => {
        if (slot !== undefined) {
            slots[slot].card.cardId = unseen[index]
        }
    })
    const dealt = new Set(holder.flatMap((slot, index) => (slot === undefined ? [] : [index])))
    const rest = unseen.filter((_, index) => !dealt.has(index))

    const pile = state.cardPiles.find(
        (candidate) => candidate.deck === deck && candidate.level === level
    )
    assert(pile !== undefined, 'Every deck is in play')
    assert(
        rest.length === pile.remaining + pile.discarded,
        'The unseen cards must fill the deck and its discards'
    )
    pile.cards = rest.slice(0, pile.remaining)
    pile.discards = rest.slice(pile.remaining)
}
