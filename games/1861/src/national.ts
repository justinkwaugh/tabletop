import { assertExists } from '@tabletop/common'
import {
    NationalStations,
    abandonOperatingTurn,
    cheapestAffordableTrain,
    getCompany,
    homeStationId,
    nationaliseCompany,
    nextOperatingCompany,
    treasuryPoolId,
    type NationalisationRules,
    type Nationalisation,
    type ReceivershipRules,
    type TrainPurchaseState,
    type MapStateData,
    type TrainRules
} from '@tabletop/18xx'
import { MajorShareCount, RsrId, RsrOutsideStationLimit } from './companies.js'
import { LoanRules1861 } from './loans.js'
import { Map1861, MoscowLocationId, StPetersburgLocationId } from './map.js'
import { requireState1861, type HydratedState1861 } from './state.js'
import { StationRules1861 } from './stations.js'
import { LeftOrDownMove, Market1861 } from './stockMarket.js'
import { TileSet1861 } from './tiles.js'
import { RsrOperatingPhaseIds, TrainDepot1861, revenueStages1861 } from './trains.js'

/** The RSR's second station, kept for Moscow. */
export const RsrMoscowStationId = `${RsrId}:station:1`

/**
 * The RSR's stations: its home kept for St. Petersburg, its second for Moscow, and six more
 * taken over anywhere, the most valuable cities first (§7.4, §11).
 */
export const RsrStations = new NationalStations({
    nationalId: RsrId,
    map: Map1861,
    tileSet: TileSet1861,
    stationRules: StationRules1861,
    revenueStages: revenueStages1861,
    keptStations: [
        { locationId: StPetersburgLocationId, stationId: homeStationId(RsrId) },
        { locationId: MoscowLocationId, stationId: RsrMoscowStationId }
    ],
    outsideLimit: RsrOutsideStationLimit
})

export const NationalisationRules1861: NationalisationRules = {
    market: Market1861,
    loans: LoanRules1861,
    // A step left a loan still owed after repaying what it can (§11).
    stepsPerLoan: 1,
    direction: LeftOrDownMove,
    // With no price floor, each space it cannot fall below R35 takes R5 off a share (GTG §14).
    payoutBelowFloor: (state, price, missed) =>
        requireState1861(state).variants.noPriceFloor ? Math.max(0, price - 5 * missed) : price,
    nationalId: RsrId,
    trainDestination: 'market',
    nationalStations: (state, companyId) =>
        RsrStations.takeOver(requireState1861(state), companyId),
    // A nationalised public company can be started again; a minor closes (§7.3, §11).
    restart: (state, companyId) =>
        getCompany(state, companyId).kind === 'major'
            ? {
                  poolId: treasuryPoolId(companyId),
                  shareCount: MajorShareCount,
                  keepsAllStations: true
              }
            : undefined
}

/**
 * Nationalises the company: its shareholders are paid, the RSR takes its assets and stations,
 * and it leaves the operating round, its turn ending if it is operating (§11). Nationalising
 * several at once names the company operating before the first, as ending its turn makes the
 * next company look as if it were operating.
 */
export function nationalise1861(
    state: HydratedState1861,
    companyId: string,
    operatingCompanyId = nextOperatingCompany(state)
): Nationalisation {
    const operating = operatingCompanyId === companyId
    const details = nationaliseCompany(state, NationalisationRules1861, companyId)
    if (state.phaseChange)
        state.phaseChange.discardCompanyIds = state.phaseChange.discardCompanyIds.filter(
            (id) => id !== companyId
        )
    RsrStations.releaseReservations(state)
    const set = state.operatingSet
    if (operating) abandonOperatingTurn(state, companyId)
    else if (set && !set.completed)
        set.companyOrder = set.companyOrder.filter(
            (id) => id !== companyId || set.completedCompanyIds.includes(id)
        )
    return details
}

/** Whether the RSR operates in this phase: from the first 4-train until the first 8-train (§7.4). */
export function rsrOperates(state: { phaseId: string }): boolean {
    return (
        RsrOperatingPhaseIds.includes(state.phaseId) &&
        !requireState1861(state).variants.trainExports
    )
}

/**
 * The RSR places its St. Petersburg station as it first operates, in the space kept for it,
 * unless it has one there already (§7.4, §14.3).
 */
export function placeRsrHome(state: HydratedState1861): boolean {
    return RsrStations.placeKept(state, StPetersburgLocationId)
}

/**
 * The RSR's train when trainless: the cheapest from the bank, borrowing for it; otherwise the
 * next new train while it can pay for one from its treasury (§10.10, GTG §8.13).
 */
function rsrTrainPurchase(
    state: TrainPurchaseState & MapStateData,
    companyId: string,
    rules: TrainRules
) {
    const trainless = !state.trainInventory.trains.some(
        (train) =>
            train.status === 'owned' &&
            train.owner.kind === 'company' &&
            train.owner.companyId === companyId
    )
    if (trainless) return cheapestAffordableTrain(state, companyId, rules)
    // Having bought the first 8-train, it goes on buying 8-trains in that turn while it can pay,
    // as it buys all it can afford (GTG §8.13); it does not operate again (§7.4).
    const definitionId = TrainDepot1861.nextDefinitionId(state.trainInventory)
    if (!definitionId) return undefined
    const train = TrainDepot1861.nextTrain(state.trainInventory, definitionId)
    if (!train) return undefined
    const price = TrainDepot1861.trainDefinition(definitionId).price
    const cash = state.cash.find(
        (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
    )?.amount
    if (typeof cash !== 'number' || cash < price) return undefined
    return { companyId, trainId: train.id, definitionId, expectedPrice: price }
}

/**
 * The RSR is run by the system: it lays no track, keeps all its earnings and buys trains; the
 * holder of the priority deal runs its trains for the best earnings (§7.4, §10).
 */
export const ReceivershipRules1861: ReceivershipRules = {
    operators: (state) => {
        const [priority] = state.turnManager.turnOrder
        assertExists(priority, 'The priority deal is held')
        return [priority]
    },
    earningsChoice: () => 'withhold',
    trainPurchase: rsrTrainPurchase
}
