import { inReceivership } from './receivership.js'
import { canRunAcquiredTrain } from './acquisitions.js'
import {
    privateOwningCompany,
    controllingOwner,
    type RouteRules,
    type TrainRunningState,
    type RouteRevenueStop,
    type RouteBonus
} from '@tabletop/18xx'
import { revenueMarkerValue, type RevenueMarkerState } from './revenueMarkers.js'
import { EighteenFortySixMap, PortSymbols, EastWestBonuses } from './map.js'
import { EighteenFortySixTileSet } from './tiles.js'
import { TrainDepot1846 } from './trains.js'
import type { SteamboatState } from './steamboat.js'

const PayingStopLimits: Readonly<Record<string, number>> = { '3/5': 3, '4/6': 4, '7/8': 7 }

export const RouteRules1846: RouteRules = {
    canOperate: (state, playerId, companyId) =>
        inReceivership(state, companyId) ||
        controllingOwner(state, companyId)?.playerId === playerId,
    canRunTrain: canRunAcquiredTrain,
    map: EighteenFortySixMap,
    tileSet: EighteenFortySixTileSet,
    depot: TrainDepot1846,
    revenueStage: (state) => [state.phaseId === 'II' ? 'I' : state.phaseId],
    routeBonuses: eastWestBonuses,
    trainBonuses(state, companyId, route, run) {
        if (privateOwningCompany(state, 'MAIL') !== companyId) return []
        const longest = run.reduce(
            (best, candidate) =>
                candidate.visits.length > best.visits.length ||
                (candidate.visits.length === best.visits.length && candidate.trainId > best.trainId)
                    ? candidate
                    : best,
            route
        )
        return longest.trainId === route.trainId
            ? route.visits.map((visit) => ({ locationId: visit.locationId, amount: 10 }))
            : []
    },
    payingStops(train, visits) {
        const count = PayingStopLimits[train.id] ?? visits.length
        if (visits.length <= count) return visits
        let best: readonly RouteRevenueStop[] = []
        let revenue = -1
        const requiresStation = visits.some((stop) => stop.companyStation)
        function select(stops: RouteRevenueStop[], start: number): void {
            if (stops.length === count) {
                if (requiresStation && !stops.some((stop) => stop.companyStation)) return
                const value =
                    stops.reduce((sum, stop) => sum + stop.amount + stop.bonus, 0) +
                    eastWestBonuses(stops).reduce((sum, bonus) => sum + bonus.amount, 0)
                if (value > revenue) {
                    best = stops
                    revenue = value
                }
                return
            }
            for (let i = start; i <= visits.length - (count - stops.length); i++)
                select([...stops, visits[i]], i + 1)
        }
        select([], 0)
        return best
    },
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

function eastWestBonuses(stops: readonly RouteRevenueStop[]): RouteBonus[] {
    const east = stops.find((stop) => EastWestBonuses[stop.locationId]?.side === 'east')
    const west = stops.find((stop) => EastWestBonuses[stop.locationId]?.side === 'west')
    return east && west
        ? [east, west].map((stop) => ({
              locationId: stop.locationId,
              amount: EastWestBonuses[stop.locationId].amount
          }))
        : []
}
