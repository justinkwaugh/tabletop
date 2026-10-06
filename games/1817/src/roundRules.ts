import type { EighteenSeventeenState } from './state.js'
import { EighteenSeventeenPhases, EighteenSeventeenTrainDepot } from './trains.js'
import { corporationShareCount } from './corporations.js'
import { isLiquidated } from './liquidation.js'
import { eighteenSeventeenOptions } from './state.js'
import {
    certificatesInPool,
    getCompany,
    privateOwningCompany,
    sharesOwned,
    trainsOwnedBy,
    signedShares,
    type StockState,
    floatedCompaniesInMarketOrder,
    playerOrderAfterLastTurn,
    type StockRoundRules,
    type OperatingRules
} from '@tabletop/18xx'

export const EighteenSeventeenStockRoundRules: StockRoundRules = {
    passing: 'consecutive',
    nextPlayerOrder: playerOrderAfterLastTurn,
    // A company of more than two shares whose players hold every share net moves up; with
    // Short Squeeze, once more when they hold over 100%.
    soldOut: (state, companyId) =>
        corporationShareCount(state, companyId) > 2 &&
        playerHoldings(state, companyId) >= corporationShareCount(state, companyId),
    squeezed: (state: StockState & Pick<EighteenSeventeenState, 'shortSqueeze'>, companyId) =>
        eighteenSeventeenOptions(state).shortSqueeze &&
        playerHoldings(state, companyId) > corporationShareCount(state, companyId),
    // Each share left in the market pool, less the market's shorts, moves the company down.
    poolDrop: (state, companyId) =>
        Math.max(
            0,
            certificatesInPool(state, MarketPoolId).reduce(
                (sum, certificate) =>
                    sum + (certificate.companyId === companyId ? signedShares(certificate) : 0),
                0
            )
        )
}

function playerHoldings(state: StockState, companyId: string): number {
    return state.players.reduce(
        (sum, player) =>
            sum +
            Math.max(
                0,
                sharesOwned(state, companyId, { kind: 'player', playerId: player.playerId })
            ),
        0
    )
}
export const MarketPoolId = 'market'
export const treasuryPoolId = (companyId: string) => `treasury:${companyId}`

// A mail private pays its company as each operating round starts, if the company has a train.
const MailIncome: Readonly<Record<string, number>> = { MINM: 10, MAIL: 15, MAJM: 20 }

export const EighteenSeventeenOperatingRules: OperatingRules = {
    roundCount: (state) => EighteenSeventeenPhases.phase(state.phaseId).operatingRounds,
    companyOrder: (state) =>
        floatedCompaniesInMarketOrder(state).filter(
            (companyId) => !isLiquidated(state.stockMarket, companyId)
        ),
    // After each round the next depot train is exported; while that is a 2, every 2 goes.
    trainsToExport(state) {
        const next = EighteenSeventeenTrainDepot.nextDefinitionId(state.trainInventory)
        if (!next) return []
        const remaining = EighteenSeventeenTrainDepot.remaining(state.trainInventory, next)
        return next === '2' && remaining !== 'unlimited' ? Array(remaining).fill(next) : [next]
    },
    privateIncome(state, privateId) {
        const mail = MailIncome[privateId]
        if (mail === undefined) return getCompany(state, privateId).privateRevenue ?? 0
        const companyId = privateOwningCompany(state, privateId)
        return companyId && trainsOwnedBy(state, { kind: 'company', companyId }).length ? mail : 0
    }
}
