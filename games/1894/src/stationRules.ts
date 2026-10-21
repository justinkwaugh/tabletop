import {
    StationPlacement,
    charterStationCost,
    charterStationCounts,
    getCompany,
    nextOperatingCompany,
    type HomeStation,
    type HomeStationChoice,
    type OperatingStationState,
    type StationRules
} from '@tabletop/18xx'
import { EighteenNinetyFourMap } from './map.js'
import { EighteenNinetyFourTileSet } from './tiles.js'
import { inFinalOperatingSet } from './endingRules.js'
import { londonAccess } from './london.js'

// §11.3.2.1, §11.3.3.1: companies with two homes place both free.
export const EighteenNinetyFourStationCosts: Readonly<Record<string, readonly number[]>> = {
    PLM: [0, 40, 100, 100, 100],
    CFOR: [0, 0, 100, 100, 100],
    Nord: [0, 0, 100, 100],
    Ouest: [0, 0, 100, 100, 100],
    Est: [0, 40, 100, 100, 100],
    AG: [0, 40, 100, 100, 100],
    Belge: [0, 40, 100],
    LF: [0, 40, 100],
    LB: [0, 40, 100]
}
export const EighteenNinetyFourStationCounts = charterStationCounts(EighteenNinetyFourStationCosts)

/** The floated company about to operate, while it still has homes to place (§7.3.1). */
function companyPlacingHomes(state: OperatingStationState): string | undefined {
    const companyId = nextOperatingCompany(state)
    if (!companyId) return undefined
    const company = getCompany(state, companyId)
    return company.floated && !company.closed ? companyId : undefined
}

/** A home hex's cities with room for the company's station. */
function openHomeCities(state: OperatingStationState, companyId: string, locationId: string) {
    const placement = new StationPlacement(state, EighteenNinetyFourStationRules)
    return placement.mapState
        .tile(locationId)
        .face.nodes.filter(
            (node) =>
                node.kind === 'city' &&
                placement.openSlots(companyId, locationId, node.id).length > 0
        )
        .map((node) => node.id)
}

type HomeSite = { locationId: string; nodeIds: string[] }
/** The company's unplaced homes: a reserved city, or any open city of a reserved hex. */
function homeSites(state: OperatingStationState, companyId: string): HomeSite[] {
    const sites: HomeSite[] = []
    for (const reservation of state.stationReservations)
        if (
            reservation.companyId === companyId &&
            !sites.some((site) => site.locationId === reservation.locationId)
        )
            sites.push({ locationId: reservation.locationId, nodeIds: [reservation.nodeId] })
    for (const reservation of state.hexReservations ?? [])
        if (reservation.companyId === companyId)
            sites.push({
                locationId: reservation.locationId,
                nodeIds: openHomeCities(state, companyId, reservation.locationId)
            })
    return sites
}

function availableStationIds(state: OperatingStationState, companyId: string): string[] {
    return state.stations
        .filter((station) => station.companyId === companyId && station.status === 'available')
        .map((station) => station.id)
}

/**
 * The homes a floated company places as it first operates, one station on each home hex
 * (§7.3.1): the PLM's in Paris's marked city, and a split city's when one of its cities is open.
 */
export function pendingHomes1894(state: OperatingStationState): HomeStation[] {
    const companyId = companyPlacingHomes(state)
    if (!companyId) return []
    const stationIds = availableStationIds(state, companyId)
    return homeSites(state, companyId)
        .filter((site) => site.nodeIds.length === 1)
        .flatMap((site, index) => {
            const stationId = stationIds[index]
            return stationId
                ? [{ stationId, locationId: site.locationId, nodeId: site.nodeIds[0] }]
                : []
        })
}

/** A home on a split city with both cities open, whose president chooses the city. */
export function homeChoice1894(state: OperatingStationState): HomeStationChoice | undefined {
    const companyId = companyPlacingHomes(state)
    if (!companyId) return undefined
    const site = homeSites(state, companyId).find((entry) => entry.nodeIds.length > 1)
    const stationId = availableStationIds(state, companyId)[pendingHomes1894(state).length]
    return site && stationId
        ? {
              companyId,
              stationId,
              positions: site.nodeIds.map((nodeId) => ({ locationId: site.locationId, nodeId }))
          }
        : undefined
}

export const EighteenNinetyFourStationRules: StationRules = {
    map: EighteenNinetyFourMap,
    tileSet: EighteenNinetyFourTileSet,
    placementCost: (state, stationId) =>
        charterStationCost(state, stationId, EighteenNinetyFourStationCosts),
    // One station a round, and none in the final set (§7.3.4).
    placementLimit: (state) => (inFinalOperatingSet(state) ? 0 : 1),
    stopAllowed: londonAccess,
    pendingHomes: pendingHomes1894,
    homeChoice: homeChoice1894
}
