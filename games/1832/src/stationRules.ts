import { assertExists } from '@tabletop/common'
import {
    charterStationCost,
    charterStationCounts,
    getCompany,
    homeStationId,
    nextOperatingCompany,
    type StationRules,
    type StationState
} from '@tabletop/18xx'
import { EighteenThirtyTwoMap } from './map.js'
import { EighteenThirtyTwoTileSet } from './tiles.js'
import { keyWestPlacedThisTurn, revenueTokenChoices } from './revenueTokens.js'
import { requireEighteenThirtyTwoState } from './state.js'
import { coalFieldsOpen } from './coalAccess.js'
import { isSystem } from './systems.js'

// Token costs from each charter, the free home token first (§7.4, §16.3).
export const EighteenThirtyTwoStationCosts: Readonly<Record<string, readonly number[]>> = {
    ACL: [0, 40, 100],
    AWP: [0, 40],
    CG: [0, 40, 100],
    FEC: [0, 40],
    GRR: [0, 40],
    GMO: [0, 40, 100],
    LN: [0, 40, 100],
    NW: [0, 40, 100],
    SAL: [0, 40, 100],
    SOU: [0, 40, 100]
}
export const EighteenThirtyTwoStationCounts = charterStationCounts(EighteenThirtyTwoStationCosts)

const MergedStationCost = 100

/**
 * A System's stations, and any a company gains past its charter by a merger, cost $100
 * (§11.6.6, §11.7.1); others follow the charter.
 */
function mergedStationCost(state: StationState, stationId: string): number {
    const station = state.stations.find((entry) => entry.id === stationId)
    assertExists(station, 'A station placement requires a known station')
    const schedule = EighteenThirtyTwoStationCosts[station.companyId] ?? []
    const used = state.stations.filter(
        (entry) => entry.companyId === station.companyId && entry.status !== 'available'
    ).length
    return isSystem(requireEighteenThirtyTwoState(state), station.companyId) ||
        used >= schedule.length
        ? MergedStationCost
        : charterStationCost(state, stationId, EighteenThirtyTwoStationCosts)
}

export const EighteenThirtyTwoStationRules: StationRules = {
    map: EighteenThirtyTwoMap,
    tileSet: EighteenThirtyTwoTileSet,
    placementCost: mergedStationCost,
    stopAllowed: coalFieldsOpen,
    placementLimit: (state, companyId) => (keyWestPlacedThisTurn(state, companyId) ? 0 : 1),
    holdsStationStep: (state, companyId) => {
        const title = requireEighteenThirtyTwoState(state)
        return title.activePlayerIds.some((playerId) =>
            revenueTokenChoices(title, playerId).some((choice) => choice.companyId === companyId)
        )
    },
    // A company places its free home token as its first operating turn begins (§7.1).
    pendingHomes(state) {
        const companyId = nextOperatingCompany(state)
        if (!companyId) return []
        const company = getCompany(state, companyId)
        const station = state.stations.find((station) => station.id === homeStationId(companyId))
        if (!company.floated || company.closed || station?.status !== 'available') return []
        const reservation = state.stationReservations.find(
            (reservation) => reservation.companyId === companyId
        )
        assertExists(reservation, 'An unplaced home station keeps its reservation')
        return [
            {
                stationId: station.id,
                locationId: reservation.locationId,
                nodeId: reservation.nodeId
            }
        ]
    }
}
