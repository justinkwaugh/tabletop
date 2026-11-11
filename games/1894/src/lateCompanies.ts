import {
    StationPlacement,
    hexReservationFulfilled,
    reservationFulfilled,
    type FormationState,
    type MapStateData,
    type StartHome
} from '@tabletop/18xx'
import { LateCompanies } from './majors.js'
import { LateHomeLocationIds } from './map.js'
import { EighteenNinetyFourStationRules } from './stationRules.js'

type HomeState = FormationState & MapStateData

/** Whether the hex is the home of another company that has not yet placed it. */
function anotherHome(state: HomeState, companyId: string, locationId: string): boolean {
    return (
        state.stationReservations.some(
            (reservation) =>
                reservation.locationId === locationId &&
                reservation.companyId !== companyId &&
                !reservationFulfilled(state, reservation, EighteenNinetyFourStationRules)
        ) ||
        (state.hexReservations ?? []).some(
            (reservation) =>
                reservation.locationId === locationId &&
                reservation.companyId !== companyId &&
                !hexReservationFulfilled(state, reservation)
        )
    )
}

/**
 * A late company's possible homes (§11.3.3): hexes of its country with an empty station space
 * that are not another unoperated company's home, preferring hexes without track. Its president
 * claims the hex as the company starts: the one open city, or any city of it when several are
 * open, for the station it places as it first operates (§7.3.1).
 */
export function lateCompanyHomes(state: HomeState, companyId: string): StartHome[] | undefined {
    const country = LateCompanies[companyId]
    if (!country) return undefined
    const placement = new StationPlacement(state, EighteenNinetyFourStationRules)
    const options = LateHomeLocationIds[country].flatMap((locationId) => {
        if (anotherHome(state, companyId, locationId)) return []
        const face = placement.mapState.tile(locationId).face
        const open = face.nodes.filter(
            (node) =>
                node.kind === 'city' &&
                placement.openSlots(companyId, locationId, node.id).length > 0
        )
        const [city] = open
        if (!city) return []
        const home: StartHome = {
            locationId,
            nodeId: city.id,
            slot: placement.openSlots(companyId, locationId, city.id)[0],
            cost: 0,
            claims: open.length === 1 ? 'city' : 'hex'
        }
        return [{ home, tracked: face.paths.length > 0 }]
    })
    const untracked = options.filter((entry) => !entry.tracked)
    return (untracked.length ? untracked : options).map((entry) => entry.home)
}
