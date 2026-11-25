import {
    NationalStations,
    abandonOperatingTurn,
    getCompany,
    homeStationId,
    nationaliseCompany,
    nextOperatingCompany,
    treasuryPoolId,
    type NationalisationRules,
    type Nationalisation
} from '@tabletop/18xx'
import { CnId, CnOutsideStationLimit, MajorShareCount } from './companies.js'
import { LoanRules1867 } from './loans.js'
import { Map1867, MontrealLocationId, TorontoLocationId } from './map.js'
import { requireState1867, type HydratedState1867 } from './state.js'
import { StationRules1867 } from './stations.js'
import { LeftMove, Market1867 } from './stockMarket.js'
import { TileSet1867 } from './tiles.js'
import { revenueStages1867 } from './trains.js'

/** Montreal's grey tile, with a space for the CN (GTG §8.13). */
const MontrealGreyTileId = '1867:639'

/** The CN's second station, kept for Montreal (GTG §8.13). */
export const CnMontrealStationId = `${CnId}:station:1`

/**
 * The CN's stations: its first in Toronto from setup, its second kept for Montreal, and six more
 * taken over from the companies it nationalises, the most valuable cities first (GTG §2.H,
 * §8.13, §10.1E).
 */
export const CnStations = new NationalStations({
    nationalId: CnId,
    map: Map1867,
    tileSet: TileSet1867,
    stationRules: StationRules1867,
    revenueStages: revenueStages1867,
    keptStations: [
        { locationId: TorontoLocationId, stationId: homeStationId(CnId) },
        { locationId: MontrealLocationId, stationId: CnMontrealStationId }
    ],
    outsideLimit: CnOutsideStationLimit
})

/**
 * Nationalisation repays what loans it can, drops the price a space and two more for each loan
 * left, and pays the players that price a share; the money goes back to the bank and the trains
 * and privates leave play, the CN taking the stations (GTG §8.13, §10.1).
 */
export const NationalisationRules1867: NationalisationRules = {
    market: Market1867,
    loans: LoanRules1867,
    stepsPerLoan: 2,
    direction: LeftMove,
    // With no price floor, each space it cannot fall below $35 takes $5 off a share (GTG §14).
    payoutBelowFloor: (state, price, missed) =>
        requireState1867(state).variants.noPriceFloor ? Math.max(0, price - 5 * missed) : price,
    trainDestination: 'removed',
    nationalStations: (state, companyId) => CnStations.takeOver(requireState1867(state), companyId),
    // A nationalised major can be started again; a minor leaves play (GTG §3.3, §10.1E).
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
 * Nationalises the company: its shareholders are paid, the CN takes its stations, and it leaves
 * the operating round, its turn ending if it is operating (GTG §10). Nationalising several at
 * once names the company operating before the first, as ending its turn makes the next company
 * look as if it were operating.
 */
export function nationalise1867(
    state: HydratedState1867,
    companyId: string,
    operatingCompanyId = nextOperatingCompany(state)
): Nationalisation {
    const operating = operatingCompanyId === companyId
    const details = nationaliseCompany(state, NationalisationRules1867, companyId)
    if (state.phaseChange)
        state.phaseChange.discardCompanyIds = state.phaseChange.discardCompanyIds.filter(
            (id) => id !== companyId
        )
    const set = state.operatingSet
    if (operating) abandonOperatingTurn(state, companyId)
    else if (set && !set.completed)
        set.companyOrder = set.companyOrder.filter(
            (id) => id !== companyId || set.completedCompanyIds.includes(id)
        )
    return details
}

/** Montreal's grey tile gives the CN its station there at once, unless it has one (RoP §7.4). */
export function cnMontrealStationDue(state: HydratedState1867): boolean {
    return CnStations.keptStationDue(state, MontrealLocationId, MontrealGreyTileId)
}
