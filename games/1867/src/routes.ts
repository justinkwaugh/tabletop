import {
    privateOwningCompany,
    type FinancialState,
    type RouteRevenuePolicy,
    type RouteRules,
    type TrainDefinition
} from '@tabletop/18xx'
import { Map1867, TimminsDoublingLocationIds, TimminsLocationId } from './map.js'
import { TimminsBonusId } from './names.js'
import { PrivateIds1867, privateTerms1867 } from './privates.js'
import { TileSet1867 } from './tiles.js'
import { DoubledTrainIds1867, ExpressTrainId, TrainDepot1867, revenueStages1867 } from './trains.js'

/** Timmins counts double on a route that also counts Toronto, Montreal or Quebec (GTG §8.8.2). */
const TimminsValue = 40
/** The 5+5E counts any five cities or off-board locations on its route (GTG §8.8.3). */
const ExpressStops = 5

const multiplier = (train: TrainDefinition) => (DoubledTrainIds1867.includes(train.id) ? 2 : 1)

/**
 * An N-train counts at most N cities and off-board locations and may skip towns, which pay when
 * it counts them among its N; a 5+5E counts any five stops (GTG §8.8.1, §8.8.3).
 */
function revenuePolicy(train: TrainDefinition): RouteRevenuePolicy {
    const limit = train.id === ExpressTrainId ? ExpressStops : train.distance.maximum
    return {
        ...(limit === 'unlimited' ? {} : { payingStopLimit: limit }),
        requirePayingStation: true,
        connectionBonuses: [
            {
                from: Object.fromEntries(TimminsDoublingLocationIds.map((id) => [id, 0])),
                to: { [TimminsLocationId]: TimminsValue * multiplier(train) },
                sourceId: TimminsBonusId
            }
        ]
    }
}

/** The private bonuses the company's privates give a stop: $10 a train at their cities (GTG §3.1). */
function privateBonusIds(state: FinancialState, companyId: string, locationId: string): string[] {
    return PrivateIds1867.filter(
        (privateId) =>
            privateTerms1867(privateId).bonusLocationIds.includes(locationId) &&
            privateOwningCompany(state, privateId) === companyId
    )
}

export const RouteRules1867: RouteRules = {
    map: Map1867,
    tileSet: TileSet1867,
    depot: TrainDepot1867,
    revenueStage: (state) => revenueStages1867(state.phaseId),
    requiresCity: () => true,
    revenuePolicy,
    // A route visits one revenue center of a hex with several separate cities (GTG §8.8.1).
    oneStopPerHex: true,
    // 5+5E- and 2+2-trains double the route's value (GTG §8.8.3).
    stopRevenue: (_state, _companyId, _center, printed, train) => printed * multiplier(train),
    stopBonus: (state, _train, companyId, center) =>
        privateBonusIds(state, companyId, center.locationId).reduce(
            (sum, privateId) => sum + privateTerms1867(privateId).bonus,
            0
        ),
    stopBonusSourceIds: (state, _train, companyId, center) =>
        privateBonusIds(state, companyId, center.locationId)
}
