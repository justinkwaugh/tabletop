import {
    StationPlacement,
    charterStationCost,
    getCompany,
    homeStationId,
    neutralStation,
    nextOperatingCompany,
    type HomeStation,
    type HomeStationChoice,
    type OperatingStationState,
    type StationPlacementState,
    type StationPosition,
    type StationRules
} from '@tabletop/18xx'
import { CnId, Majors1882 } from './companies.js'
import { Map1882 } from './map.js'
import { TileSet1882 } from './tiles.js'

const StationCosts1882 = Object.fromEntries(
    Majors1882.map((company) => [company.id, company.stationCosts])
)

/** The floated company about to operate first, while its home station waits (§11.4). */
function companyPlacingHome(state: OperatingStationState): string | undefined {
    const companyId = nextOperatingCompany(state)
    if (!companyId) return undefined
    const company = getCompany(state, companyId)
    const home = state.stations.find((station) => station.id === homeStationId(companyId))
    return company.floated && !company.closed && home?.status === 'available'
        ? companyId
        : undefined
}

/** The first open space of each city in the hexes where the company may place a station. */
export function openCityPositions(
    state: StationPlacementState,
    companyId: string,
    locationIds: readonly string[]
): StationPosition[] {
    const placement = new StationPlacement(state, StationRules1882)
    return locationIds.flatMap((locationId) =>
        placement.mapState.tile(locationId).face.nodes.flatMap((node) => {
            const [slot] =
                node.kind === 'city' ? placement.openSlots(companyId, locationId, node.id) : []
            return slot === undefined ? [] : [{ locationId, nodeId: node.id, slot }]
        })
    )
}

/** The QL's home: either of Regina's cities still open when it first operates (§10.4 note 1). */
function openHomeCities(
    state: OperatingStationState,
    companyId: string
): HomeStationChoice['positions'] {
    const locationIds = (state.hexReservations ?? [])
        .filter((reservation) => reservation.companyId === companyId)
        .map((reservation) => reservation.locationId)
    return openCityPositions(state, companyId, locationIds).map(({ locationId, nodeId }) => ({
        locationId,
        nodeId
    }))
}

function pendingHomes1882(state: OperatingStationState): HomeStation[] {
    const companyId = companyPlacingHome(state)
    if (!companyId) return []
    const stationId = homeStationId(companyId)
    const reserved = state.stationReservations.find(
        (reservation) => reservation.companyId === companyId
    )
    if (reserved) return [{ stationId, locationId: reserved.locationId, nodeId: reserved.nodeId }]
    const open = openHomeCities(state, companyId)
    return open.length === 1 ? [{ stationId, ...open[0] }] : []
}

function homeChoice1882(state: OperatingStationState): HomeStationChoice | undefined {
    const companyId = companyPlacingHome(state)
    if (!companyId) return undefined
    const positions = openHomeCities(state, companyId)
    return positions.length > 1
        ? { companyId, stationId: homeStationId(companyId), positions }
        : undefined
}

const charterCost1882 = charterStationCost(StationCosts1882)

export const StationRules1882: StationRules = {
    map: Map1882,
    tileSet: TileSet1882,
    // A neutral station is free; the second station costs $40 and later ones $100 (§11.4).
    placementCost: (state, stationId, context) =>
        neutralStation(state, stationId) ? 0 : charterCost1882(state, stationId, context),
    // One station a turn, a neutral one or the company's own; the CN places none (§10.4, §11.4).
    placementLimit: (_state, companyId) => (companyId === CnId ? 0 : 1),
    pendingHomes: pendingHomes1882,
    homeChoice: homeChoice1882
}
