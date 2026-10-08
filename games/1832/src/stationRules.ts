import { assertExists } from '@tabletop/common'
import {
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
 * A company's stations follow its charter's costs; a System's, those a company gains past its
 * charter by a merger, and any returned to the charter from a shared city cost $100 (§7.3.3,
 * §11.6.6, §11.7.1).
 */
function mergedStationCost(state: StationState, stationId: string): number {
    const station = state.stations.find((entry) => entry.id === stationId)
    assertExists(station, 'A station placement requires a known station')
    const title = requireEighteenThirtyTwoState(state)
    const schedule = EighteenThirtyTwoStationCosts[station.companyId] ?? []
    // A company's own charter pieces come first among its stations; merged ones follow.
    const charter = state.stations
        .filter((entry) => entry.companyId === station.companyId)
        .slice(0, schedule.length)
    if (
        isSystem(title, station.companyId) ||
        title.returnedStationIds?.includes(stationId) ||
        !charter.some((entry) => entry.id === stationId)
    )
        return MergedStationCost
    const cost = schedule[charter.filter((entry) => entry.status !== 'available').length]
    assertExists(cost, 'The charter prices each of its stations')
    return cost
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
