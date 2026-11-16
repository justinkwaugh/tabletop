import {
    privateOwningCompany,
    type FinancialState,
    type RouteRevenuePolicy,
    type RouteRules,
    type TrainDefinition
} from '@tabletop/18xx'
import { EkaterinburgLocationId, Map1861, MoscowLocationId } from './map.js'
import { EkaterinburgBonusId } from './names.js'
import { PrivateIds1861, privateTerms1861 } from './privates.js'
import { TileSet1861 } from './tiles.js'
import { DoubledTrainIds1861, ExpressTrainId, TrainDepot1861, revenueStages1861 } from './trains.js'

/** Ekaterinburg counts double on a route that also includes Moscow (§10.6). */
const EkaterinburgValue = 40
/** The 5+5E counts any five cities or off-board areas on its route (§10.6). */
const ExpressStops = 5

const multiplier = (train: TrainDefinition) => (DoubledTrainIds1861.includes(train.id) ? 2 : 1)

/**
 * An N-train counts at most N cities and off-board areas and may skip towns, which pay when it
 * counts them among its N; a 5+5E counts any five stops (§10.6).
 */
function revenuePolicy(train: TrainDefinition): RouteRevenuePolicy {
    const limit = train.id === ExpressTrainId ? ExpressStops : train.distance.maximum
    return {
        ...(limit === 'unlimited' ? {} : { payingStopLimit: limit }),
        requirePayingStation: true,
        connectionBonuses: [
            {
                from: { [MoscowLocationId]: 0 },
                to: { [EkaterinburgLocationId]: EkaterinburgValue * multiplier(train) },
                sourceId: EkaterinburgBonusId
            }
        ]
    }
}

/** The private bonuses the company's privates give a stop: R10 a train at their cities (§7.1). */
function privateBonusIds(state: FinancialState, companyId: string, locationId: string): string[] {
    return PrivateIds1861.filter(
        (privateId) =>
            privateTerms1861(privateId).bonusLocationIds.includes(locationId) &&
            privateOwningCompany(state, privateId) === companyId
    )
}

export const RouteRules1861: RouteRules = {
    map: Map1861,
    tileSet: TileSet1861,
    depot: TrainDepot1861,
    revenueStage: (state) => revenueStages1861(state.phaseId),
    requiresCity: () => true,
    revenuePolicy,
    // A route visits each city and off-board area once, and one space of a city with several
    // separate ones (§10.1).
    oneStopPerHex: true,
    // 5+5E- and 2+2-trains double the route's value (§10.6).
    stopRevenue: (_state, _companyId, _center, printed, train) => printed * multiplier(train),
    stopBonus: (state, _train, companyId, center) =>
        privateBonusIds(state, companyId, center.locationId).reduce(
            (sum, privateId) => sum + privateTerms1861(privateId).bonus,
            0
        ),
    stopBonusSourceIds: (state, _train, companyId, center) =>
        privateBonusIds(state, companyId, center.locationId)
}
