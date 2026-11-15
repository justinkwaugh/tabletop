import {
    CardDeck,
    CardUnavailable,
    cardCost,
    cardDefinition,
    cardUnavailability,
    deckName,
    romanLevel,
    type CardLevel,
    type HydratedStellarHorizonsGameState
} from '@tabletop/stellar-horizons-2'

// "Planetary Surveys (I)", as the card's title bar prints it.
export function cardTitle(cardId: string): string {
    const definition = cardDefinition(cardId)
    return `${definition.name} (${romanLevel(definition.level)})`
}

// "a level II fleet improvement": what everyone sees of a card back.
export function cardBackText(deck: CardDeck, level: CardLevel): string {
    return `a level ${romanLevel(level)} ${deckName(deck)}`
}

// One row of a console's card ledger: an owned card, or one in hand. A hand card the viewer may
// not see has no `cardId`; one they may see carries its price to them now and why it cannot be
// bought, if it cannot.
export interface CardRow {
    key: string
    deck: CardDeck
    level: CardLevel
    cardId?: string
    cost?: number
    unavailable?: CardUnavailable
}

export interface CardLedger {
    owned: CardRow[]
    hand: CardRow[]
    points: number
}

const byDeckAndLevel = (a: CardRow, b: CardRow) => a.deck.localeCompare(b.deck) || a.level - b.level

// A Player's owned cards and hand, each in deck then level order (fleet improvements first).
// Their hand shows its cards only to them (`ownHand`); to others it is backs.
export function cardLedger(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    ownHand: boolean
): CardLedger {
    const player = state.getPlayerState(playerId)
    const owned = player.cards
        .map((card): CardRow => {
            const { deck, level } = cardDefinition(card.cardId)
            return { key: card.cardId, deck, level, cardId: card.cardId }
        })
        .sort(byDeckAndLevel)
    const hand = player.hand
        .map((card, index): CardRow => {
            const cardId = ownHand ? card.cardId : undefined
            if (cardId === undefined) {
                return {
                    key: `${card.deck}-${card.level}-${index}`,
                    deck: card.deck,
                    level: card.level
                }
            }
            const unavailable = cardUnavailability(state, playerId, cardId)
            return {
                key: cardId,
                deck: card.deck,
                level: card.level,
                cardId,
                cost: cardCost(state, playerId, cardId),
                ...(unavailable ? { unavailable } : {})
            }
        })
        .sort(byDeckAndLevel)
    return { owned, hand, points: player.cardPoints() }
}

// Why a card in hand cannot be bought now, as the ledger and the card's details say it.
export function unavailabilityText(cardId: string, reason: CardUnavailable): string {
    const definition = cardDefinition(cardId)
    switch (reason) {
        case CardUnavailable.TypeBought:
            return `A ${definition.field.toLowerCase()} tech or card is already bought this turn`
        case CardUnavailable.Excluded:
            return definition.excludes
                ? `Cannot be owned with ${cardDefinition(definition.excludes).name}`
                : 'Cannot be bought'
        case CardUnavailable.NotHeld:
            return 'Not in hand'
    }
}
