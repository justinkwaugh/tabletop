import {
    SpaceKind,
    TERRAIN_COST,
    isMapSpace,
    mapSpace,
    neighboringSpaces
} from '../components/map.js'
import {
    Ability,
    KOLN_MINDENER_SPENDING_LIMIT,
    RailroadId,
    maxTrackPerExpansion,
    railroadDefinition
} from '../components/railroads.js'
import { cubesLeft, findRailroad, occupants } from './network.js'
import type { RailroadState } from './railroadState.js'

export type ExpansionTally = {
    built: number
    spent: number
    freeRuralCost: number
}

export const FRESH_EXPANSION: ExpansionTally = { built: 0, spent: 0, freeRuralCost: 0 }

export function isRural(spaceId: string): boolean {
    return mapSpace(spaceId).kind === SpaceKind.Rural
}

export function entryCost(
    railroads: readonly RailroadState[],
    railroadId: RailroadId,
    spaceId: string
): number {
    const space = mapSpace(spaceId)
    const ability = railroadDefinition(railroadId).ability
    const penalty =
        space.kind === SpaceKind.City && ability !== Ability.NoCityPenalty
            ? occupants(railroads, spaceId).filter((id) => id !== railroadId).length
            : 0
    const cost = TERRAIN_COST[space.terrain] + penalty
    return ability === Ability.CheaperTrack ? Math.max(0, cost - 1) : cost
}

export function canEnter(
    railroads: readonly RailroadState[],
    network: readonly string[],
    spaceId: string
): boolean {
    if (!isMapSpace(spaceId) || network.includes(spaceId)) {
        return false
    }
    if (!neighboringSpaces(spaceId).some((neighbor) => network.includes(neighbor))) {
        return false
    }
    const kind = mapSpace(spaceId).kind
    if (kind === SpaceKind.City) {
        return true
    }
    if (occupants(railroads, spaceId).length > 0) {
        return false
    }
    return (
        kind !== SpaceKind.Approach ||
        !network.some((built) => mapSpace(built).kind === SpaceKind.Approach)
    )
}

// The Badische's free rural track is always its dearest one this Expansion, whatever order it
// builds in: each rural track is charged so that the running total never includes that one.
export function trackCharge(
    railroads: readonly RailroadState[],
    railroadId: RailroadId,
    spaceId: string,
    tally: ExpansionTally
): number {
    const cost = entryCost(railroads, railroadId, spaceId)
    if (railroadDefinition(railroadId).ability !== Ability.FreeRural || !isRural(spaceId)) {
        return cost
    }
    return cost > tally.freeRuralCost ? tally.freeRuralCost : cost
}

export function canBuild(
    railroads: readonly RailroadState[],
    railroadId: RailroadId,
    spaceId: string,
    tally: ExpansionTally
): boolean {
    const railroad = findRailroad(railroads, railroadId)
    if (tally.built >= maxTrackPerExpansion(railroadId) || cubesLeft(railroad) === 0) {
        return false
    }
    if (!canEnter(railroads, railroad.track, spaceId)) {
        return false
    }
    const charge = trackCharge(railroads, railroadId, spaceId, tally)
    if (charge > railroad.treasury) {
        return false
    }
    return (
        railroadDefinition(railroadId).ability !== Ability.FiveDollarMax ||
        tally.spent + charge <= KOLN_MINDENER_SPENDING_LIMIT
    )
}

export function buildChoices(
    railroads: readonly RailroadState[],
    railroadId: RailroadId,
    tally: ExpansionTally
): string[] {
    const network = findRailroad(railroads, railroadId).track
    const frontier = new Set(network.flatMap((spaceId) => neighboringSpaces(spaceId)))
    return [...frontier].filter((spaceId) => canBuild(railroads, railroadId, spaceId, tally))
}

export function canExpand(railroads: readonly RailroadState[], railroadId: RailroadId): boolean {
    return buildChoices(railroads, railroadId, FRESH_EXPANSION).length > 0
}

export function tallyAfter(
    railroads: readonly RailroadState[],
    railroadId: RailroadId,
    spaceId: string,
    tally: ExpansionTally
): ExpansionTally {
    const charge = trackCharge(railroads, railroadId, spaceId, tally)
    const rural = railroadDefinition(railroadId).ability === Ability.FreeRural && isRural(spaceId)
    return {
        built: tally.built + 1,
        spent: tally.spent + charge,
        freeRuralCost: rural
            ? Math.max(tally.freeRuralCost, entryCost(railroads, railroadId, spaceId))
            : tally.freeRuralCost
    }
}
