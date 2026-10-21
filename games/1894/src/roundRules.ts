import { EighteenNinetyFourCharters } from './charters.js'
import { EighteenNinetyFourMarket } from './stockMarket.js'
import { EighteenNinetyFourPhases } from './trains.js'
import { privateIncome1894 } from './privateRules.js'
import {
    allSharesHeld,
    floatedCompaniesInMarketOrder,
    getCompany,
    sharesOwned,
    type OperatingRules,
    type StockRoundRules
} from '@tabletop/18xx'

/** A company the IPO and the bank pool no longer hold shares of (§6.2). */
export function soldOut1894(
    state: Parameters<StockRoundRules['soldOut']>[0],
    companyId: string
): boolean {
    return allSharesHeld(
        state,
        companyId,
        (certificate) =>
            certificate.owner.kind === 'player' ||
            (certificate.owner.kind === 'company' && certificate.owner.companyId === companyId)
    )
}

export const EighteenNinetyFourStockRoundRules: StockRoundRules = {
    // The other colour's number cards record the order in which players passed and kept
    // passing; the next stock round follows them (§6.1–6.2).
    passing: 'pass-order',
    nextPlayerOrder: (state) => [...state.stockRound.passedPlayerIds],
    soldOut: soldOut1894,
    // One space, another when the president and treasury hold eight shares, and another when
    // the price started in the gray area (§10.2).
    soldOutRises(state, companyId) {
        const president = getCompany(state, companyId).president
        const held =
            sharesOwned(state, companyId, { kind: 'company', companyId }) +
            (president ? sharesOwned(state, companyId, president) : 0)
        const gray =
            EighteenNinetyFourMarket.companySpace(state.stockMarket, companyId).color === 'gray'
        return 1 + (held >= 8 ? 1 : 0) + (gray ? 1 : 0)
    }
}

export const EighteenNinetyFourOperatingRules: OperatingRules = {
    charters: EighteenNinetyFourCharters,
    roundCount: (state) => EighteenNinetyFourPhases.phase(state.phaseId).operatingRounds,
    companyOrder: (state) => floatedCompaniesInMarketOrder(EighteenNinetyFourMarket, state),
    privateIncome: (state, privateId) => privateIncome1894(state, privateId)
}
