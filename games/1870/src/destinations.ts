import {
    DestinationRunProcedure,
    DestinationStationSource,
    StationPlacement,
    destinationStationId,
    homeStationId,
    type RevenueCenter
} from '@tabletop/18xx'
import { OperatingRules1870 } from './stock.js'
import { company1870, OffboardHomeCompanyId } from './companies.js'
import { OffboardHomeLocationId } from './map.js'
import { RouteRules1870 } from './routes.js'
import { requireState1870, type HydratedState1870 } from './state.js'
import { StationRules1870 } from './stations.js'

const home = (state: HydratedState1870, companyId: string): RevenueCenter | undefined => {
    if (companyId === OffboardHomeCompanyId)
        return { locationId: OffboardHomeLocationId, nodeId: 'offboard' }
    const station = state.stations.find((entry) => entry.id === homeStationId(companyId))
    return station?.status === 'placed'
        ? { locationId: station.position.locationId, nodeId: station.position.nodeId }
        : undefined
}

const WarCities: readonly string[] = ['C18', 'J3', 'J5', 'N17']

function openSpace(state: HydratedState1870, center: RevenueCenter): number | undefined {
    const placement = new StationPlacement(
        {
            ...state,
            stationAccess: state.stationAccess?.filter(
                (access) =>
                    access.locationId !== center.locationId ||
                    access.sourceId !== DestinationStationSource
            )
        },
        StationRules1870
    )
    return placement.openSlots('', center.locationId, center.nodeId)[0]
}

function occupySpace(
    state: HydratedState1870,
    companyId: string,
    center: RevenueCenter,
    slot: number
): void {
    const id = destinationStationId(companyId)
    state.stations = state.stations.map((station) =>
        station.id === id
            ? { id, companyId, status: 'placed', position: { ...center, slot } }
            : station
    )
}

function addAccess(state: HydratedState1870, companyId: string, center: RevenueCenter): void {
    state.stationAccess = [
        ...(state.stationAccess ?? []),
        { companyId, ...center, sourceId: DestinationStationSource }
    ]
}

/**
 * Beside the city's spaces; with Station Marker Wars, in an open space of Dallas, Fort Worth, New
 * Orleans or St. Louis if it has one, otherwise beside them until one opens (p. 25).
 */
export function placeWarStation(
    state: HydratedState1870,
    companyId: string,
    center: RevenueCenter
): void {
    const slot =
        state.variants.stationWars && WarCities.includes(center.locationId)
            ? openSpace(state, center)
            : undefined
    if (slot === undefined) addAccess(state, companyId, center)
    else occupySpace(state, companyId, center, slot)
}

export function stationWarsAfterLay(state: object, locationId: string): void {
    const title = requireState1870(state)
    if (!title.variants.stationWars || !WarCities.includes(locationId)) return
    for (const access of title.stationAccess ?? []) {
        if (access.locationId !== locationId || access.sourceId !== DestinationStationSource)
            continue
        const center = { locationId, nodeId: access.nodeId }
        const slot = openSpace(title, center)
        if (slot === undefined) continue
        title.stationAccess = title.stationAccess?.filter((entry) => entry !== access)
        occupySpace(title, access.companyId, center, slot)
    }
}

export const DestinationRuns1870 = new DestinationRunProcedure<HydratedState1870>({
    routeRules: () => RouteRules1870,
    companyOrder: (state) => OperatingRules1870.companyOrder(state),
    destination: (companyId) => company1870(companyId)?.destination,
    home,
    placeStation: placeWarStation
})
