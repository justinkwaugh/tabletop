import { TechField } from '../components/techFields.js'
import { TECHS, TechId, techDefinition } from '../components/techs.js'
import { TECH_POINTS_PER_INFLUENCE, isCampaign } from './campaign.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'

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
    return Math.max(MIN_TECH_COST, techDefinition(techId).cost - OWNER_DISCOUNT * owners)
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

export function canAffordTech(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    techId: TechId
): boolean {
    const player = state.getPlayerState(playerId)
    const field = techDefinition(techId).field
    return (
        player.markerTotal(field) + influencePoints(state, playerId) + player.cash >=
        techCost(state, playerId, techId)
    )
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

export function isValidTechPayment(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    techId: TechId,
    markers: readonly number[],
    cash: number,
    influence = 0
): boolean {
    const player = state.getPlayerState(playerId)
    const field: TechField = techDefinition(techId).field
    const markerValue = markers.reduce((total, value) => total + value, 0)
    const cost = techCost(state, playerId, techId)
    const afterMarkers = Math.max(0, cost - markerValue)
    const influenceValue = influence * TECH_POINTS_PER_INFLUENCE
    return (
        Number.isInteger(cash) &&
        cash >= 0 &&
        cash <= player.cash &&
        Number.isInteger(influence) &&
        influence >= 0 &&
        (influence === 0 || isCampaign(state)) &&
        influence <= player.influence &&
        influence <= Math.ceil(afterMarkers / TECH_POINTS_PER_INFLUENCE) &&
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
