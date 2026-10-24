import {
    CardDeck,
    cardDefinition,
    deckName,
    romanLevel,
    type CardLevel
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
