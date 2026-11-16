import {
    getCompany,
    homeStationId,
    nextOperatingCompany,
    type HomeStation,
    type OperatingStationState,
    type StationRules
} from '@tabletop/18xx'
import {
    LnwrId,
    LondonLocationId,
    MetropolitanId,
    SecrId,
    StationCost1822,
    destinationStationId,
    major1822,
    minor1822
} from './companies.js'
import { Map1822 } from './map.js'
import { requireState1822 } from './state.js'
import { EnglishChannelLocationId } from './privates.js'
import { TileSet1822 } from './tiles.js'

/** A home station still to be placed as its company first operates (§5.6.1). */
function pendingHome(
    state: OperatingStationState,
    stationId: string,
    home: { locationId: string; nodeId: string }
): HomeStation[] {
    return state.stations.some(
        (station) => station.id === stationId && station.status === 'available'
    )
        ? [{ stationId, ...home }]
        : []
}

/**
 * The homes the next company places as its first turn begins: its home station, and for the LNWR
 * its destination token in Manchester too (§5.6.1, §5.6.2). The Metropolitan Railway chooses
 * and pays for its own (§5.6.7).
 */
function pendingHomes(state: OperatingStationState): HomeStation[] {
    const companyId = nextOperatingCompany(state)
    if (!companyId || companyId === MetropolitanId || !getCompany(state, companyId).floated)
        return []
    const major = major1822(companyId)
    const home = major?.home ?? minor1822(companyId)?.home
    if (!home) return []
    return [
        ...pendingHome(state, homeStationId(companyId), home),
        ...(major && companyId === LnwrId
            ? pendingHome(state, destinationStationId(companyId), major.destination)
            : [])
    ]
}

export const StationRules1822: StationRules = {
    map: Map1822,
    tileSet: TileSet1822,
    // A station token costs £100; the SECR places one in the English Channel free (§5.12.11,
    // §5.12.12).
    placementCost: (state, stationId, context) => {
        const station = state.stations.find((entry) => entry.id === stationId)
        return station?.companyId === SecrId &&
            context?.position.locationId === EnglishChannelLocationId
            ? 0
            : StationCost1822
    },
    // A major company places one station token a turn; a minor only ever has its home (§5.12.5,
    // §5.12.9).
    placementLimit: (state, companyId) => (getCompany(state, companyId).kind === 'major' ? 1 : 0),
    pendingHomes,
    // A company may hold a station in more than one of London's six, never two in one (§5.4.2,
    // §5.12.6).
    citiesApart: (locationId) => locationId === LondonLocationId,
    opensBesideCity: (state, locationId, nodeId) =>
        locationId === LondonLocationId && requireState1822(state).vacatedRoundelNodeId === nodeId
}
