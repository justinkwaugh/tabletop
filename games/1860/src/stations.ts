import {
    charterStationCost,
    homeStationId,
    inReceivership,
    releaseHomeReservations,
    type MapStateData,
    type StationPosition,
    type StationRules
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { Companies1860, company1860 } from './companies.js'
import { Map1860 } from './map.js'
import { requireState1860 } from './state.js'
import { TileSet1860, mapState1860 } from './tiles.js'

/** Each charter's bases: the free home base, £40 for the second and £100 each after. */
export const StationCosts1860: Readonly<Record<string, readonly number[]>> = Object.fromEntries(
    Companies1860.map((company) => [company.id, company.stationCosts])
)

type HomeState = MapStateData

/** The large station of the company's home hex, and its first space no station fills. */
function homeSpace(state: HomeState, companyId: string): StationPosition {
    const locationId = company1860(companyId).home
    const city = mapState1860(state)
        .tile(locationId)
        .face.nodes.find((node) => node.kind === 'city')
    assertExists(city, 'Every home is a large station')
    const taken = state.stations.flatMap((station) =>
        station.status === 'placed' &&
        station.position.locationId === locationId &&
        station.position.nodeId === city.id
            ? [station.position.slot]
            : []
    )
    const slots = city.kind === 'city' ? city.stationSlots : 0
    const slot = Array.from({ length: slots }, (_, index) => index).find(
        (index) => !taken.includes(index)
    )
    assertExists(slot, 'The home reservation keeps a space for the home base')
    return { locationId, nodeId: city.id, slot }
}

/** Whether the home hex still has no track on it, so the director lays its tile as it floats. */
export function homeHexBare(state: HomeState, companyId: string): boolean {
    const tile = mapState1860(state).tile(company1860(companyId).home)
    return !tile.placement && tile.face.color === 'white'
}

/** Places a floating company's home base, unless it stands there already from before. */
export function placeHomeBase(state: HomeState, companyId: string): void {
    const stationId = homeStationId(companyId)
    const station = state.stations.find((entry) => entry.id === stationId)
    assertExists(station, 'Every company has its home base')
    if (station.status === 'placed') return
    const position = homeSpace(state, companyId)
    state.stations = state.stations.map((entry) =>
        entry.id === stationId
            ? { id: entry.id, companyId: entry.companyId, status: 'placed', position }
            : entry
    )
    releaseHomeReservations(state, companyId, [position.locationId])
}

export const StationRules1860: StationRules = {
    map: Map1860,
    tileSet: TileSet1860,
    placementCost: charterStationCost(StationCosts1860),
    // One base a turn; none for an insolvent company or one in receivership, nor once a stock
    // round has followed the Southern's formation (Building Bases; Insolvency; Receivership).
    placementLimit(state, companyId) {
        const title = requireState1860(state)
        return title.southernStockRound ||
            title.insolventIds.includes(companyId) ||
            inReceivership(title, companyId)
            ? 0
            : 1
    },
    // Homes are placed as companies float (Flotation & Capitalisation).
    pendingHomes: () => []
}
