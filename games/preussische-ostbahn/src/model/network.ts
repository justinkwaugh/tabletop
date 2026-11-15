import { assertExists } from '@tabletop/common'
import { SpaceKind, cityValue, mapSpace } from '../components/map.js'
import {
    Ability,
    BERLIN_HAMBURGER_TERMINI,
    RailroadId,
    SHARES_PER_RAILROAD,
    railroadDefinition
} from '../components/railroads.js'
import type { RailroadState } from './railroadState.js'

export function findRailroad(railroads: readonly RailroadState[], id: RailroadId): RailroadState {
    const railroad = railroads.find((candidate) => candidate.id === id)
    assertExists(railroad, `Unknown railroad ${id}`)
    return railroad
}

export function occupants(railroads: readonly RailroadState[], spaceId: string): RailroadId[] {
    return railroads
        .filter((railroad) => railroad.track.includes(spaceId))
        .map((railroad) => railroad.id)
}

export function cubesLeft(railroad: RailroadState): number {
    return railroadDefinition(railroad.id).track - railroad.track.length
}

export function unsoldShares(railroad: RailroadState): number {
    return SHARES_PER_RAILROAD - railroad.owners.length
}

export function cityIds(railroad: RailroadState): string[] {
    return railroad.track.filter((spaceId) => mapSpace(spaceId).kind === SpaceKind.City)
}

export function hasBuiltApproach(railroad: RailroadState): boolean {
    return railroad.track.some((spaceId) => mapSpace(spaceId).kind === SpaceKind.Approach)
}

export function railroadIncome(railroad: RailroadState): number {
    const values = cityIds(railroad).map(cityValue)
    const total = values.reduce((sum, value) => sum + value, 0)
    return railroadDefinition(railroad.id).ability === Ability.DoubleCity
        ? total + Math.max(0, ...values)
        : total
}

export function paysDividends(railroad: RailroadState): boolean {
    return (
        railroadDefinition(railroad.id).ability !== Ability.MustConnect ||
        BERLIN_HAMBURGER_TERMINI.every((spaceId) => railroad.track.includes(spaceId))
    )
}

export function directConnections(
    railroads: readonly RailroadState[],
    id: RailroadId
): RailroadId[] {
    const cities = cityIds(findRailroad(railroads, id))
    return railroads
        .filter((other) => other.id !== id && cities.some((city) => other.track.includes(city)))
        .map((other) => other.id)
}

export function sharesHeld(railroad: RailroadState, playerId: string): number {
    return railroad.owners.filter((owner) => owner === playerId).length
}

export function playerIncome(railroads: readonly RailroadState[], playerId: string): number {
    return railroads.reduce(
        (sum, railroad) => sum + sharesHeld(railroad, playerId) * railroadIncome(railroad),
        0
    )
}
