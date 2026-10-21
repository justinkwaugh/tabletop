import {
    StationPlacement,
    hexReservationFulfilled,
    reservationFulfilled,
    type CompanyRules,
    type HomeOption
} from '@tabletop/18xx'
import { LateCompanies } from './majors.js'
import { LateHomeLocationIds } from './map.js'
import { EighteenNinetyFourStationRules } from './stationRules.js'

type HomeState = Parameters<NonNullable<CompanyRules['homeChoices']>>[0]

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
 * that are not another unoperated company's home, preferring hexes without track. Its home is
 * the city when only one city is open, otherwise any city of the hex.
 */
export function lateCompanyHomes(state: HomeState, companyId: string): HomeOption[] | undefined {
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
        if (!open.length) return []
        const option: HomeOption =
            open.length === 1 ? { locationId, nodeId: open[0].id } : { locationId }
        return [{ option, tracked: face.paths.length > 0 }]
    })
    const untracked = options.filter((entry) => !entry.tracked)
    return (untracked.length ? untracked : options).map((entry) => entry.option)
}
