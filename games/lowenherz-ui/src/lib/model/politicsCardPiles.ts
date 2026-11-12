import { Visibility, type GameAction } from '@tabletop/common'
import {
    isTakePoliticsCard,
    samePoliticsCard,
    type PoliticsCard,
    type TakePoliticsCard
} from '@tabletop/lowenherz'

export type PoliticsPile = TakePoliticsCard['pile']

// Pile A always renders on the left, pile B on the right (see chooserDeckCenter in
// politicsCardLayout.ts), so players know the piles by where they sit on screen.
export const politicsPileSide: Record<PoliticsPile, 'left' | 'right'> = { A: 'left', B: 'right' }

// A take as this viewer's history records it: the card is there only for the player who took it.
export type RecordedTake = { playerId: string; pile: PoliticsPile; card?: PoliticsCard }
export type KnownTake = RecordedTake & { card: PoliticsCard }

export function isKnownTake(take: RecordedTake): take is KnownTake {
    return take.card !== undefined
}

export function recordedTakes(actions: readonly GameAction[]): RecordedTake[] | undefined {
    // Projection replaces actions it cannot reverse with redacted records, which hide their takes.
    if (actions.some(Visibility.isRedactedAction)) return undefined
    return actions
        .filter(isTakePoliticsCard)
        .map(({ playerId, pile, card }): RecordedTake => ({ playerId, pile, card }))
}

// A hand gains cards at the end as they are taken and spends the first matching copy, so the
// copies of a card still held are always that card's latest takes, in order.
export function politicsCardPiles(
    hand: readonly PoliticsCard[],
    takes: readonly Pick<KnownTake, 'pile' | 'card'>[]
): Map<PoliticsCard, PoliticsPile> {
    const piles = new Map<PoliticsCard, PoliticsPile>()
    for (const card of hand) {
        if (piles.has(card)) continue
        const copies = hand.filter((held) => samePoliticsCard(held, card))
        const takesOfCard = takes.filter((take) => samePoliticsCard(take.card, card))
        const firstHeldTake = takesOfCard.length - copies.length
        copies.forEach((copy, index) => {
            const take = takesOfCard[firstHeldTake + index]
            if (take) piles.set(copy, take.pile)
        })
    }
    return piles
}

export type PoliticsCardSource = PoliticsPile | 'either'

// What another player's hand shows of its decks, from the decks of their takes alone: the cards
// they took are hidden from you, so once they have spent a card you cannot tell which take it
// was. A deck is certain for as many cards as it gave more than they have spent, and the rest
// could be from either. With nothing spent a real hand still holds every take in take order,
// but a hand sampled for Exploration is shuffled, so visible faces there are pinned only when
// every card must come from one deck.
export function otherPlayerCardDecks(
    handCount: number,
    takePiles: readonly PoliticsPile[],
    facesVisible: boolean,
    handInTakeOrder: boolean
): PoliticsCardSource[] | undefined {
    const spent = takePiles.length - handCount
    if (spent < 0) return undefined
    if (spent === 0 && (handInTakeOrder || !facesVisible)) return [...takePiles]
    const certain = (pile: PoliticsPile) =>
        Math.max(0, takePiles.filter((taken) => taken === pile).length - spent)
    const left = certain('A')
    const right = certain('B')
    if (left === handCount) return repeat('A', handCount)
    if (right === handCount) return repeat('B', handCount)
    if (facesVisible) return repeat('either', handCount)
    return [
        ...repeat('A', left),
        ...repeat('B', right),
        ...repeat('either', handCount - left - right)
    ]
}

function repeat(deck: PoliticsCardSource, count: number): PoliticsCardSource[] {
    return Array.from({ length: count }, () => deck)
}
