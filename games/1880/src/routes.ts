import {
    companyMarketSpaceId,
    controllingOwner,
    ownsNoTrain,
    privateOwner,
    type RouteRevenuePolicy,
    type RouteRules,
    type TrainDefinition,
    type TrainRunningState
} from '@tabletop/18xx'
import { P2Id, P3Id } from './companies.js'
import {
    FerryLocationIds,
    Map1880,
    RussiaLocationId,
    TaiwanLocationId,
    VladivostokLocationId
} from './map.js'
import { FerryChargeId, TaiwanBonusId, TransSiberianBonusId } from './names.js'
import { requireState1880 } from './state.js'
import { isInvestor } from './stock.js'
import { marketBonus } from './stockMarket.js'
import { TileSet1880 } from './tiles.js'
import { PayingStopLimits1880, TrainDepot1880, phaseLetter } from './trains.js'

/** A route from Russia to Vladivostok earns ¥50 more (§X Bonus for the Trans-Siberian Line). */
export const TransSiberianBonus = 50
/** Each ferry a route crosses costs ¥10, unless P2's owner directs the company (§VI, §X). */
export const FerryCharge = 10
/** Taiwan is worth ¥20 more to the companies P3's owner directs (§VI). */
export const TaiwanBonus = 20

/** Whether the player owning the private directs the company, an investor included (§VI). */
function directsWith(state: TrainRunningState, companyId: string, privateId: string): boolean {
    const owner = privateOwner(state, privateId)
    const director = controllingOwner(state, companyId)
    return owner?.kind === 'player' && director?.playerId === owner.playerId
}

/**
 * E-trains count their best stations, one of them their company's, and pass the rest; a route
 * between Russia and Vladivostok earns the Trans-Siberian bonus (§X).
 */
function revenuePolicy(train: TrainDefinition): RouteRevenuePolicy {
    const payingStopLimit = PayingStopLimits1880[train.id]
    return {
        ...(payingStopLimit ? { payingStopLimit, requirePayingStation: true as const } : {}),
        connectionBonuses: [
            {
                from: { [RussiaLocationId]: 0 },
                to: { [VladivostokLocationId]: TransSiberianBonus },
                sourceId: TransSiberianBonusId
            }
        ],
        bonusesAlongRoute: true
    }
}

export const RouteRules1880: RouteRules = {
    map: Map1880,
    tileSet: TileSet1880,
    depot: TrainDepot1880,
    // Off-board areas and harbours pay their phase's value: A, B, C or D (§X).
    revenueStage: (state) => [phaseLetter(state.phaseId)],
    requiresCity: () => false,
    revenuePolicy,
    stopBonus: (state, _train, companyId, center) =>
        center.locationId === TaiwanLocationId && directsWith(state, companyId, P3Id)
            ? TaiwanBonus
            : 0,
    stopBonusSourceIds: (state, _train, companyId, center) =>
        center.locationId === TaiwanLocationId && directsWith(state, companyId, P3Id)
            ? [TaiwanBonusId]
            : [],
    hexBonus: (state, locationId, companyId) =>
        FerryLocationIds.includes(locationId) && !directsWith(state, companyId, P2Id)
            ? -FerryCharge
            : 0,
    hexBonusSourceIds: (state, locationId, companyId) =>
        FerryLocationIds.includes(locationId) && !directsWith(state, companyId, P2Id)
            ? [FerryChargeId]
            : [],
    // A major whose price stands on a bonus space adds ten times its bonus to its income, if it
    // owns a train (§X Bonus from the Share Price Chart).
    runBonus: (state, companyId) =>
        isInvestor(companyId) || ownsNoTrain(state, companyId)
            ? 0
            : marketBonus(companyMarketSpaceId(requireState1880(state).stockMarket, companyId))
}
