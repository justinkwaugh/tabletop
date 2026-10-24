import { cardDefinition } from '../components/cards.js'
import { TechField } from '../components/techFields.js'
import { TECHS, TechId, techDefinition } from '../components/techs.js'
import { TECH_POINTS_PER_INFLUENCE, isCampaign } from './campaign.js'
import { cardCost, isCardAvailable } from './cards.js'
import { capabilitiesOf } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { roundHalfUp } from './turn.js'

export const MIN_TECH_COST = 5
export const OWNER_DISCOUNT = 3

export function techCost(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    techId: TechId
): number {
    const owners = state
        .otherPlayers(playerId)
        .filter((player) => player.ownedBefore(techId, state.year)).length
    const definition = techDefinition(techId)
    // A Breakthrough event halves the printed cost of one tech of its type this turn.
    const printed = state.getPlayerState(playerId).breakthroughs.includes(definition.field)
        ? roundHalfUp(definition.cost / 2)
        : definition.cost
    // The skilled genetic manipulations, Enhanced Intellect, Neural Interface and Hive Mind.
    const cards = capabilitiesOf(state, playerId).techDiscount[definition.field]
    return Math.max(MIN_TECH_COST, printed - OWNER_DISCOUNT * owners - cards)
}

// What the development phase sells: techs from the chart and, in the campaign, cards from the
// Player's hand (rulebook 1.19 and 1.20). Both are paid the same way.
export type Purchase = { techId: TechId } | { cardId: string }

interface PurchaseRules {
    field: TechField
    cost(state: HydratedStellarHorizonsGameState, playerId: string): number
    isAvailable(state: HydratedStellarHorizonsGameState, playerId: string): boolean
}

function purchaseRules(purchase: Purchase): PurchaseRules {
    if ('techId' in purchase) {
        const { techId } = purchase
        return {
            field: techDefinition(techId).field,
            cost: (state, playerId) => techCost(state, playerId, techId),
            isAvailable: (state, playerId) => isTechAvailable(state, playerId, techId)
        }
    }
    const { cardId } = purchase
    return {
        field: cardDefinition(cardId).field,
        cost: (state, playerId) => cardCost(state, playerId, cardId),
        isAvailable: (state, playerId) => isCardAvailable(state, playerId, cardId)
    }
}

export function purchaseField(purchase: Purchase): TechField {
    return purchaseRules(purchase).field
}

export function purchaseCost(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    purchase: Purchase
): number {
    return purchaseRules(purchase).cost(state, playerId)
}

export function isPurchaseAvailable(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    purchase: Purchase
): boolean {
    return purchaseRules(purchase).isAvailable(state, playerId)
}

export function isTechAvailable(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    techId: TechId
): boolean {
    const player = state.getPlayerState(playerId)
    const definition = techDefinition(techId)
    return (
        !player.ownsTech(techId) &&
        !player.fieldsDeveloped.includes(definition.field) &&
        definition.prerequisites.every((prerequisite) =>
            player.ownedBefore(prerequisite, state.year)
        )
    )
}

export function influencePoints(state: HydratedStellarHorizonsGameState, playerId: string) {
    return isCampaign(state)
        ? state.getPlayerState(playerId).influence * TECH_POINTS_PER_INFLUENCE
        : 0
}

export function canAfford(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    purchase: Purchase
): boolean {
    const player = state.getPlayerState(playerId)
    const field = purchaseField(purchase)
    return (
        player.markerTotal(field) + influencePoints(state, playerId) + player.cash >=
        purchaseCost(state, playerId, purchase)
    )
}

export function canAffordTech(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    techId: TechId
): boolean {
    return canAfford(state, playerId, { techId })
}

// The IP a payment may use after its markers: what the Player holds, and never more than the
// points still owed.
export function maxPaymentInfluence(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    purchase: Purchase,
    markerValue: number
): number {
    if (!isCampaign(state)) {
        return 0
    }
    const owed = Math.max(0, purchaseCost(state, playerId, purchase) - markerValue)
    return Math.min(
        state.getPlayerState(playerId).influence,
        Math.ceil(owed / TECH_POINTS_PER_INFLUENCE)
    )
}

export interface CashAndInfluence {
    influence: number
    maxInfluence: number
    cash: number
}

// How the rest of a purchase's cost after its markers is paid: the IP chosen, or by default as
// few as leave a cost the Player's cash can cover, and cash for whatever remains.
export function cashAndInfluence(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    purchase: Purchase,
    markerValue: number,
    chosenInfluence?: number
): CashAndInfluence {
    const maxInfluence = maxPaymentInfluence(state, playerId, purchase, markerValue)
    const owed = Math.max(0, purchaseCost(state, playerId, purchase) - markerValue)
    const short = Math.max(0, owed - state.getPlayerState(playerId).cash)
    const influence = Math.min(
        maxInfluence,
        chosenInfluence ?? Math.ceil(short / TECH_POINTS_PER_INFLUENCE)
    )
    return {
        influence,
        maxInfluence,
        cash: Math.max(0, owed - influence * TECH_POINTS_PER_INFLUENCE)
    }
}

// Rulebook 1.19 (campaign box): every Player who buys a tech nobody owned at the start of the
// turn earns 1 IP.
export function isFirstToDevelop(state: HydratedStellarHorizonsGameState, techId: TechId) {
    return !state.players.some((player) => player.ownedBefore(techId, state.year))
}

export function isMarkerSubset(held: readonly number[], spent: readonly number[]): boolean {
    const remaining = [...held]
    return spent.every((value) => {
        const index = remaining.indexOf(value)
        if (index < 0) {
            return false
        }
        remaining.splice(index, 1)
        return true
    })
}

export function isValidPayment(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    purchase: Purchase,
    markers: readonly number[],
    cash: number,
    influence = 0
): boolean {
    const player = state.getPlayerState(playerId)
    const field: TechField = purchaseField(purchase)
    const markerValue = markers.reduce((total, value) => total + value, 0)
    const cost = purchaseCost(state, playerId, purchase)
    const afterMarkers = Math.max(0, cost - markerValue)
    const influenceValue = influence * TECH_POINTS_PER_INFLUENCE
    return (
        Number.isInteger(cash) &&
        cash >= 0 &&
        cash <= player.cash &&
        Number.isInteger(influence) &&
        influence >= 0 &&
        influence <= maxPaymentInfluence(state, playerId, purchase, markerValue) &&
        isMarkerSubset(player.techMarkers[field], markers) &&
        markerValue + influenceValue + cash >= cost &&
        cash <= Math.max(0, afterMarkers - influenceValue)
    )
}

export function removeMarkers(held: number[], spent: readonly number[]) {
    for (const value of spent) {
        held.splice(held.indexOf(value), 1)
    }
}

export function canDevelopAnyTech(state: HydratedStellarHorizonsGameState, playerId: string) {
    return TECHS.some(
        (definition) =>
            isTechAvailable(state, playerId, definition.id) &&
            canAffordTech(state, playerId, definition.id)
    )
}

export function canBuyAnyCard(state: HydratedStellarHorizonsGameState, playerId: string) {
    return state
        .getPlayerState(playerId)
        .hand.some(
            ({ cardId }) =>
                cardId !== undefined &&
                isCardAvailable(state, playerId, cardId) &&
                canAfford(state, playerId, { cardId })
        )
}
