import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import type { Faction } from '../components/factions.js'
import {
    centuryRow,
    factionSheet,
    type CenturyRow,
    type FactionAbilities
} from '../components/factionSheets.js'
import { starSystemDefinition } from '../components/systems.js'
import { TECH_FIELDS } from '../components/techFields.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { TechMarkers, emptyTechMarkers } from './playerState.js'
import { awardTechMarkers } from './pools.js'

export function isCampaign(state: HydratedStellarHorizonsGameState): boolean {
    return state.scenarioDefinition().campaign !== undefined
}

export function playerFaction(state: HydratedStellarHorizonsGameState, playerId: string): Faction {
    const faction = state.getPlayerState(playerId).faction
    assertExists(faction, `${playerId} has no faction`)
    return faction
}

// Faction sheets and abilities apply only in the campaign (Player Guide 1.0).
export function factionAbilities(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): FactionAbilities {
    const faction = state.getPlayerState(playerId).faction
    return isCampaign(state) && faction !== undefined ? factionSheet(faction).abilities : {}
}

export function currentCenturyRow(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): CenturyRow | undefined {
    const faction = state.getPlayerState(playerId).faction
    return isCampaign(state) && faction !== undefined ? centuryRow(faction, state.year) : undefined
}

// Rulebook 1.2 and 1.8: the campaign caps ships and bases by century.
export function maxShips(state: HydratedStellarHorizonsGameState, playerId: string) {
    return currentCenturyRow(state, playerId)?.maxShips ?? Number.POSITIVE_INFINITY
}

export function maxBases(state: HydratedStellarHorizonsGameState, playerId: string) {
    return currentCenturyRow(state, playerId)?.maxBases ?? Number.POSITIVE_INFINITY
}

export function atShipLimit(state: HydratedStellarHorizonsGameState, playerId: string) {
    return state.shipsOf(playerId).length >= maxShips(state, playerId)
}

export function atBaseLimit(state: HydratedStellarHorizonsGameState, playerId: string) {
    return state.basesOf(playerId).length >= maxBases(state, playerId)
}

// The True Path treat every system's habitability as 20% higher, to at most 100%.
export const MAX_HABITABILITY = 100

export function effectiveHabitability(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): number {
    const bonus = factionAbilities(state, playerId).habitabilityBonus ?? 0
    return Math.min(MAX_HABITABILITY, starSystemDefinition(systemId).habitability + bonus)
}

export function gainInfluence(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    amount: number
) {
    if (isCampaign(state)) {
        state.getPlayerState(playerId).influence += amount
    }
}

// Rulebook 1.19: in the campaign an IP pays 2 tech points of any one type.
export const TECH_POINTS_PER_INFLUENCE = 2
// IP's chart: an IP may be turned into $1B at any time.
export const CASH_PER_INFLUENCE = 1

export function canSpendInfluence(state: HydratedStellarHorizonsGameState, playerId: string) {
    return isCampaign(state) && state.getPlayerState(playerId).influence > 0
}

export type EarthProduction = Type.Static<typeof EarthProduction>
export const EarthProduction = Type.Object({
    cash: Type.Number(),
    markers: TechMarkers,
    emptyPoolCash: Type.Number()
})

// Rulebook 4.3: cash and tech markers by century from the faction sheet, and any extra markers
// an event gives (First Contact). A marker its pool
// cannot supply is paid as $1B, as for every other draw.
export function produceAtEarth(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    extraMarkers = 0
): EarthProduction {
    const row = currentCenturyRow(state, playerId)
    assertExists(row, `${playerId} has no faction sheet`)
    const player = state.getPlayerState(playerId)
    player.cash += row.cash
    const markers = emptyTechMarkers()
    let emptyPoolCash = 0
    for (const field of TECH_FIELDS) {
        const award = awardTechMarkers(state, playerId, field, row.markers[field] + extraMarkers)
        markers[field] = award.markers
        emptyPoolCash += award.cash
    }
    return { cash: row.cash, markers, emptyPoolCash }
}
