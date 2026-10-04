import { TechField } from '../components/techFields.js'
import { TechId, techDefinition } from '../components/techs.js'
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

export function canAffordTech(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    techId: TechId
): boolean {
    const player = state.getPlayerState(playerId)
    const field = techDefinition(techId).field
    return player.markerTotal(field) + player.cash >= techCost(state, playerId, techId)
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
    cash: number
): boolean {
    const player = state.getPlayerState(playerId)
    const field: TechField = techDefinition(techId).field
    const markerValue = markers.reduce((total, value) => total + value, 0)
    const cost = techCost(state, playerId, techId)
    return (
        Number.isInteger(cash) &&
        cash >= 0 &&
        cash <= player.cash &&
        isMarkerSubset(player.techMarkers[field], markers) &&
        markerValue + cash >= cost &&
        cash <= Math.max(0, cost - markerValue)
    )
}

export function removeMarkers(held: number[], spent: readonly number[]) {
    for (const value of spent) {
        held.splice(held.indexOf(value), 1)
    }
}
