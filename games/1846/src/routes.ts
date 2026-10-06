import { inReceivership } from './receivership.js'
import { canRunAcquiredTrain } from './acquisitions.js'
import {
    privateOwningCompany,
    controllingOwner,
    type RouteRules,
    type TrainRunningState,
    type PaidConnectionBonus
} from '@tabletop/18xx'
import { revenueMarkerValue, type RevenueMarkerState } from './revenueMarkers.js'
import { EighteenFortySixMap, PortSymbols, EastWestBonuses } from './map.js'
import { EighteenFortySixTileSet } from './tiles.js'
import { Phases1846, TrainDepot1846 } from './trains.js'
import type { SteamboatState } from './steamboat.js'

const PayingStopLimits: Readonly<Record<string, number>> = { '3/5': 3, '4/6': 4, '7/8': 7 }

const EastWestConnection: PaidConnectionBonus = {
    from: Object.fromEntries(
        Object.entries(EastWestBonuses)
            .filter(([, bonus]) => bonus.side === 'east')
            .map(([locationId, bonus]) => [locationId, bonus.amount])
    ),
    to: Object.fromEntries(
        Object.entries(EastWestBonuses)
            .filter(([, bonus]) => bonus.side === 'west')
            .map(([locationId, bonus]) => [locationId, bonus.amount])
    )
}

export const RouteRules1846: RouteRules = {
    canOperate: (state, playerId, companyId) =>
        inReceivership(state, companyId) ||
        controllingOwner(state, companyId)?.playerId === playerId,
    canRunTrain: canRunAcquiredTrain,
    map: EighteenFortySixMap,
    tileSet: EighteenFortySixTileSet,
    depot: TrainDepot1846,
    revenueStage: (state) => Phases1846.phase(state.phaseId).tileColors,
    revenuePolicy: (train) => ({
        payingStopLimit: PayingStopLimits[train.id],
        requirePayingStation: true,
        connectionBonuses: [EastWestConnection]
    }),
    longestRouteBonusPerStop: (state, companyId) =>
        privateOwningCompany(state, 'MAIL') === companyId ? 10 : 0,
    requiresCity: () => true,
    oneStopPerHex: true,
    stopBonus(
        state: TrainRunningState & SteamboatState & RevenueMarkerState,
        _train,
        companyId,
        center
    ) {
        const playerAssignment =
            state.steamboat?.companyId === companyId &&
            state.steamboat.locationId === center.locationId
                ? 20 * (PortSymbols[center.locationId] ?? 0)
                : 0
        return (
            playerAssignment +
            state.revenueMarkers
                .filter(
                    (marker) =>
                        marker.companyId === companyId && marker.locationId === center.locationId
                )
                .reduce(
                    (sum, marker) =>
                        sum + revenueMarkerValue(marker.privateCompanyId, marker.locationId),
                    0
                )
        )
    }
}
