import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import {
    CARD_DECKS,
    CARD_LEVELS,
    CardDeck,
    cardDefinition,
    deckCards,
    type CardLevel
} from '../components/cards.js'
import { isCampaign } from './campaign.js'
import { capabilitiesOf } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { CardPile } from './pieces.js'

// Rulebook 1.20 and setup step 13: six decks, fleet improvements and genetic manipulations in
// three levels each. Draws are random from a deck, so there is no order to hide.
export const MIN_CARD_COST = 5
export const REWARD_CARD_LEVEL: CardLevel = 1

export function initialCardPiles(): CardPile[] {
    return CARD_DECKS.flatMap((deck) =>
        CARD_LEVELS.map((level) => {
            const cards = deckCards(deck, level)
            return { deck, level, cards, remaining: cards.length, discards: [], discarded: 0 }
        })
    )
}

export function cardPile(
    state: HydratedStellarHorizonsGameState,
    deck: CardDeck,
    level: CardLevel
): CardPile {
    const pile = state.cardPiles.find(
        (candidate) => candidate.deck === deck && candidate.level === level
    )
    assertExists(pile, `No ${deck} ${level} deck`)
    return pile
}

// A deck's public counts follow the hidden cards they stand for.
export function recountPile(pile: CardPile) {
    pile.remaining = pile.cards.length
    pile.discarded = pile.discards.length
}

// The levels a Player may draw from now: those their techs allow whose deck has cards left.
export function drawableLevels(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    deck: CardDeck
): CardLevel[] {
    const highest = capabilitiesOf(state, playerId).cardLevels[deck]
    return CARD_LEVELS.filter(
        (level) => level <= highest && cardPile(state, deck, level).remaining > 0
    )
}

// What the Player's hand lacks of its size for each deck, beyond the draws already owed.
export function oweHandDraws(state: HydratedStellarHorizonsGameState, playerId: string) {
    if (!isCampaign(state)) {
        return
    }
    const player = state.getPlayerState(playerId)
    const sizes = capabilitiesOf(state, playerId).handSize
    for (const deck of CARD_DECKS) {
        const owed = player.cardDraws.filter((candidate) => candidate === deck).length
        const short = sizes[deck] - player.handCards(deck).length - owed
        for (let draw = 0; draw < short; draw++) {
            player.cardDraws.push(deck)
        }
    }
}

export function nextCardDrawer(state: HydratedStellarHorizonsGameState): string | undefined {
    return state
        .initiativeOrder()
        .find((playerId) => state.getPlayerState(playerId).cardDraws.length > 0)
}

function takeRandomCard(state: HydratedStellarHorizonsGameState, pile: CardPile): string {
    const index = state.getProtectedPrng().randInt(pile.cards.length)
    const [cardId] = pile.cards.splice(index, 1)
    recountPile(pile)
    return cardId
}

function discard(state: HydratedStellarHorizonsGameState, cardId: string) {
    const definition = cardDefinition(cardId)
    const pile = cardPile(state, definition.deck, definition.level)
    pile.discards.push(cardId)
    recountPile(pile)
}

// A Player may not hold or own two copies of a card (rulebook 1.20).
export function holdsOrOwns(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    cardId: string
): boolean {
    const player = state.getPlayerState(playerId)
    return player.ownsCard(cardId) || player.hand.some((card) => card.cardId === cardId)
}

export type CardDraw = Type.Static<typeof CardDraw>
export const CardDraw = Type.Object({
    cardId: Type.String(),
    kept: Type.Boolean()
})

// One card for the Player's first owed draw of a deck, from a level they may draw. A copy of a
// card they hold or own is discarded and the draw stays owed.
export function drawCard(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    deck: CardDeck,
    level: CardLevel
): CardDraw {
    const player = state.getPlayerState(playerId)
    const cardId = takeRandomCard(state, cardPile(state, deck, level))
    if (holdsOrOwns(state, playerId, cardId)) {
        discard(state, cardId)
        return { cardId, kept: false }
    }
    player.hand.push({ playerId, deck, level, cardId })
    player.cardDraws.splice(player.cardDraws.indexOf(deck), 1)
    return { cardId, kept: true }
}

// With no deck left at a level the Player may use, the draw is given up; a later deal fills
// the hand.
export function giveUpCardDraw(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    deck: CardDeck
) {
    const draws = state.getPlayerState(playerId).cardDraws
    draws.splice(draws.indexOf(deck), 1)
}

// A Player who bought no tech and no card this turn discards their whole hand and redraws.
export function discardHand(state: HydratedStellarHorizonsGameState, playerId: string): number {
    const player = state.getPlayerState(playerId)
    const count = player.hand.length
    for (const card of player.hand) {
        assertExists(card.cardId, 'The host sees every hand')
        discard(state, card.cardId)
    }
    player.hand = []
    return count
}

// Discards are shuffled back into their decks at the end of the turn.
export function shuffleDiscards(state: HydratedStellarHorizonsGameState): number {
    let count = 0
    for (const pile of state.cardPiles) {
        count += pile.discards.length
        pile.cards.push(...pile.discards)
        pile.discards = []
        recountPile(pile)
    }
    return count
}

export enum RewardCardOutcome {
    Earned = 'Earned',
    FromHand = 'FromHand',
    AlreadyOwned = 'AlreadyOwned',
    DeckEmpty = 'DeckEmpty'
}

export type RewardCard = Type.Static<typeof RewardCard>
export const RewardCard = Type.Object({
    deck: Type.Enum(CardDeck),
    cardId: Type.Optional(Type.String()),
    outcome: Type.Enum(RewardCardOutcome)
})

// Rulebook 1.16, Alien Derelict and Alien Remains: earn a level I card of the deck. One already
// owned is discarded; one in the hand is earned from it and the hand draws a replacement at
// once (campaign plan, slice 4, Q4).
export function earnRewardCard(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    deck: CardDeck
): RewardCard {
    const pile = cardPile(state, deck, REWARD_CARD_LEVEL)
    if (pile.remaining === 0) {
        return { deck, outcome: RewardCardOutcome.DeckEmpty }
    }
    const player = state.getPlayerState(playerId)
    const cardId = takeRandomCard(state, pile)
    if (player.ownsCard(cardId)) {
        discard(state, cardId)
        return { deck, cardId, outcome: RewardCardOutcome.AlreadyOwned }
    }
    player.cards.push({ cardId, year: state.year, bought: false })
    const held = player.hand.findIndex((card) => card.cardId === cardId)
    if (held >= 0) {
        player.hand.splice(held, 1)
    }
    // Not only a card from the hand leaves it short: Creative raises the hand size.
    oweHandDraws(state, playerId)
    return {
        deck,
        cardId,
        outcome: held >= 0 ? RewardCardOutcome.FromHand : RewardCardOutcome.Earned
    }
}

// Rulebook 1.20: the printed cost, +5 for each card of the same type and level the Player owns
// (+3 for their faction's favoured deck), less the card discounts, never below 5.
export function cardCost(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    cardId: string
): number {
    const definition = cardDefinition(cardId)
    const capabilities = capabilitiesOf(state, playerId)
    const owned = state.getPlayerState(playerId).cards.filter((card) => {
        const other = cardDefinition(card.cardId)
        return other.deck === definition.deck && other.level === definition.level
    }).length
    return Math.max(
        MIN_CARD_COST,
        definition.cost +
            owned * capabilities.cardSurcharge[definition.deck] -
            capabilities.cardDiscount[definition.deck]
    )
}

export enum CardUnavailable {
    NotHeld = 'NotHeld',
    TypeBought = 'TypeBought',
    Excluded = 'Excluded'
}

// Why a card cannot be bought now, if it cannot. A card bought counts as the tech purchase of
// its type for the turn; Increased and Reduced Body Size exclude each other.
export function cardUnavailability(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    cardId: string
): CardUnavailable | undefined {
    const player = state.getPlayerState(playerId)
    const definition = cardDefinition(cardId)
    if (!isCampaign(state) || !player.hand.some((card) => card.cardId === cardId)) {
        return CardUnavailable.NotHeld
    }
    if (player.fieldsDeveloped.includes(definition.field)) {
        return CardUnavailable.TypeBought
    }
    if (definition.excludes !== undefined && player.ownsCard(definition.excludes)) {
        return CardUnavailable.Excluded
    }
    return undefined
}

export function isCardAvailable(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    cardId: string
): boolean {
    return cardUnavailability(state, playerId, cardId) === undefined
}

export function hasBoughtThisTurn(state: HydratedStellarHorizonsGameState, playerId: string) {
    return state.getPlayerState(playerId).fieldsDeveloped.length > 0
}
