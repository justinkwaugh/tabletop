import {
    ConstructionReachability,
    RailwayMapState,
    getCompany,
    homeStationId,
    nextOperatingCompany,
    type CompanyDecisionState
} from '@tabletop/18xx'
import { Map1849 } from './map.js'
import { requireState1849 } from './state.js'
import { TileSet1849 } from './tiles.js'
import { Phases1849 } from './trains.js'

/** Station tokens may be bought from phase 6 (§14.1). */
export const StationPurchasePhaseId1849 = '6H'

// One reach per company, map and stations, as every station offered asks the same question.
const reaches = new WeakMap<object, WeakMap<object, Map<string, ConstructionReachability>>>()
function reach(state: CompanyDecisionState, companyId: string): ConstructionReachability {
    const byStations = reaches.get(state.tileInventory) ?? new WeakMap()
    reaches.set(state.tileInventory, byStations)
    const byCompany = byStations.get(state.stations) ?? new Map()
    byStations.set(state.stations, byCompany)
    const found = byCompany.get(companyId)
    if (found) return found
    const made = new ConstructionReachability(
        new RailwayMapState(Map1849, TileSet1849, state.tileInventory),
        state,
        companyId
    )
    byCompany.set(companyId, made)
    return made
}

/**
 * Why the operating corporation may not buy a station token now (§14.1), if it may: with the
 * variant, from phase 6, after running trains, once a turn, never a home token nor in a city
 * where it already has a token, and only where its routes reach. The seller keeps a station.
 */
export function stationPurchaseReason1849(
    stateObject: CompanyDecisionState,
    companyId: string,
    stationId: string
): string | undefined {
    const state = requireState1849(stateObject)
    if (!state.variants.buyStationTokens) return 'Station tokens are not bought in this game.'
    if (!Phases1849.isAtLeast(state.phaseId, StationPurchasePhaseId1849))
        return 'Station tokens may be bought from phase 6.'
    if (
        state.machineState !== 'BuyingTrains' ||
        nextOperatingCompany(state) !== companyId ||
        state.trainPurchaseStep?.companyId !== companyId
    )
        return 'A corporation buys a station token after running its trains.'
    const set = state.operatingSet
    const bought = state.stationPurchase
    if (
        set &&
        bought?.companyId === companyId &&
        bought.operatingSet === set.number &&
        bought.round === set.roundNumber
    )
        return 'A corporation buys one station token a turn.'
    if (
        !state.stations.some(
            (entry) => entry.companyId === companyId && entry.status === 'available'
        )
    )
        return 'The corporation has no station token to put in its place.'
    const station = state.stations.find((entry) => entry.id === stationId)
    if (station?.status !== 'placed' || station.companyId === companyId)
        return 'Choose another corporation’s station.'
    if (station.id === homeStationId(station.companyId)) return 'A home token cannot be bought.'
    const { locationId } = station.position
    if (
        state.stations.some(
            (entry) =>
                entry.companyId === companyId &&
                entry.status === 'placed' &&
                entry.position.locationId === locationId
        )
    )
        return 'The corporation already has a token in that city.'
    if (
        !state.stations.some(
            (entry) =>
                entry.companyId === station.companyId &&
                entry.status === 'placed' &&
                entry.id !== station.id
        )
    )
        return 'The seller would have no station left.'
    if (getCompany(state, station.companyId).closed) return 'Choose an open corporation’s station.'
    if (!reach(state, companyId).canReach(locationId))
        return 'The corporation’s routes do not reach that city.'
    return undefined
}

/** Records the turn's station token purchase (§14.1). */
export function recordStationPurchase1849(stateObject: CompanyDecisionState, companyId: string) {
    const state = requireState1849(stateObject)
    const set = state.operatingSet
    if (set) state.stationPurchase = { companyId, operatingSet: set.number, round: set.roundNumber }
}
