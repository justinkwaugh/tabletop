import type { StationRules } from '@tabletop/18xx'
import { TheOldPrinceMap } from './map.js'
import { TheOldPrinceTileSet } from './tiles.js'
export const TheOldPrinceStationRules: StationRules = {
    map: TheOldPrinceMap,
    tileSet: TheOldPrinceTileSet,
    placementCost: () => 80,
    placementLimit: (_state, companyId) => (companyId === 'PEIR' ? 0 : 1),
    pendingHomes: () => [],
    reservationOccupant: (reservation) => `PEIR:${reservation.companyId}`
}
