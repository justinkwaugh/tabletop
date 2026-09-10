import { type StationRules } from '@tabletop/18xx'
import { Shikoku1889Map } from './map.js'
import { Shikoku1889TileSet } from './tiles.js'
export const Shikoku1889StationCounts: Readonly<Record<string, number>> = {
    AR: 2,
    IR: 2,
    SR: 2,
    KO: 2,
    TR: 3,
    KU: 1,
    UR: 3
}
export const Shikoku1889StationRules: StationRules = {
    map: Shikoku1889Map,
    tileSet: Shikoku1889TileSet,
    placementCost: () => 40,
    placementLimit: () => 1,
    pendingHomes(state) {
        return state.stationReservations.flatMap((reservation) => {
            const company = state.companies.find((company) => company.id === reservation.companyId)
            const station = state.stations.find(
                (station) => station.id === `${reservation.companyId}:home`
            )
            return company?.floated && !company.closed && station?.status === 'available'
                ? [
                      {
                          stationId: station.id,
                          locationId: reservation.locationId,
                          nodeId: reservation.nodeId
                      }
                  ]
                : []
        })
    }
}
