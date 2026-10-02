import { EighteenSeventeenPhases } from './trains.js'
import {
    certificatesInPool,
    floatedCompaniesInMarketOrder,
    getCompany,
    playerOrderAfterLastTurn,
    type StockRoundRules,
    type OperatingRules
} from '@tabletop/18xx'

export const EighteenSeventeenStockRoundRules: StockRoundRules = {
    passing: 'consecutive',
    nextPlayerOrder: playerOrderAfterLastTurn,
    // A company of more than two shares whose players hold every share moves up.
    soldOut(state, companyId) {
        const company = getCompany(state, companyId)
        if (!company.started || company.closed || !company.shareCount || company.shareCount <= 2)
            return false
        const playerShares = state.certificates.reduce(
            (sum, certificate) =>
                sum +
                (!certificate.retired &&
                certificate.kind === 'share' &&
                certificate.companyId === companyId &&
                certificate.owner.kind === 'player'
                    ? certificate.shares
                    : 0),
            0
        )
        return playerShares >= company.shareCount
    },
    // Each share left in the market pool moves the company down one space.
    poolDrop: (state, companyId) =>
        certificatesInPool(state, MarketPoolId).reduce(
            (sum, certificate) =>
                sum +
                (certificate.kind === 'share' && certificate.companyId === companyId
                    ? certificate.shares
                    : 0),
            0
        )
}
export const MarketPoolId = 'market'
export const treasuryPoolId = (companyId: string) => `treasury:${companyId}`

export const EighteenSeventeenOperatingRules: OperatingRules = {
    roundCount: (state) => EighteenSeventeenPhases.phase(state.phaseId).operatingRounds,
    companyOrder: floatedCompaniesInMarketOrder
}
