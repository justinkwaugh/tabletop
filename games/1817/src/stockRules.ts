import { EighteenSeventeenCharters } from './charters.js'
import { EighteenSeventeenMarket } from './stockMarket.js'
import { assertExists } from '@tabletop/common'
import {
    SizedCompanyAuction,
    StationPlacement,
    closePrivate,
    companyShareCount,
    getCompany,
    playersAfterPresident,
    settleCashPayments,
    solventPlayerCount,
    standardCertificateWeight,
    stockCertificateCount,
    type StockRules
} from '@tabletop/18xx'
import { EighteenSeventeenStockRoundRules } from './roundRules.js'
import { EighteenSeventeenMap } from './map.js'
import { EighteenSeventeenStationRules } from './stationRules.js'
import { EighteenSeventeenPrivateCatalog } from './privates.js'
import { EighteenSeventeenCompanySizes } from './trains.js'
import { EighteenSeventeenCompanyMarket } from './marketZones.js'
import { EighteenSeventeenStations } from './owedStations.js'
import { LoanSharkCash, LoanSharkId, PonziSchemeId } from './privateHolders.js'

export const EighteenSeventeenCertificateLimits: Readonly<Record<number, number>> = {
    3: 21,
    4: 16,
    5: 13,
    6: 11,
    7: 9,
    8: 8,
    9: 7,
    10: 6,
    11: 6,
    12: 5
}

/**
 * Bids open at $100 and rise in $5 steps to $400; the company starts at half the bid. The Loan
 * Shark brings its company cash when contributed, and the Ponzi Scheme closes then.
 */
export const EighteenSeventeenCompanyAuction = new SizedCompanyAuction({
    market: EighteenSeventeenCompanyMarket,
    stations: EighteenSeventeenStations,
    openingBid: 100,
    increment: 5,
    bidCap: 400,
    privateFaceValue: (privateId) => EighteenSeventeenPrivateCatalog.faceValue(privateId),
    shareCounts(state) {
        const shareCounts = EighteenSeventeenCompanySizes[state.phaseId]
        assertExists(shareCounts, 'Every 1817 phase names its company sizes')
        return shareCounts
    },
    homes(state, companyId) {
        const placement = new StationPlacement(state, EighteenSeventeenStationRules)
        return EighteenSeventeenMap.definition.locations.flatMap((location) =>
            placement.mapState.tile(location.id).face.nodes.flatMap((node) => {
                const slot = placement.openSlots(companyId, location.id, node.id)[0]
                return slot === undefined
                    ? []
                    : [{ locationId: location.id, nodeId: node.id, slot }]
            })
        )
    },
    atCertificateLimit(state, playerId) {
        const player = { kind: 'player' as const, playerId }
        return (
            stockCertificateCount(state, player, EighteenSeventeenStockRules) >=
            EighteenSeventeenStockRules.certificateLimit(state, player)
        )
    },
    formed(state, formation) {
        if (formation.privateIds.includes(LoanSharkId))
            settleCashPayments(state, [
                {
                    from: { kind: 'bank' },
                    to: { kind: 'company', companyId: formation.companyId },
                    amount: LoanSharkCash
                }
            ])
        if (formation.privateIds.includes(PonziSchemeId)) closePrivate(state, PonziSchemeId)
    }
})

export const EighteenSeventeenStockRules: StockRules = {
    market: EighteenSeventeenMarket,
    charters: EighteenSeventeenCharters,
    round: EighteenSeventeenStockRoundRules,
    instructions: {
        securePresidency: (state, companyId, owner) =>
            EighteenSeventeenCompanyMarket.securePresidency(state, companyId, owner)
    },
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms: (state, certificate, buyer) =>
        EighteenSeventeenCompanyMarket.purchaseTerms(state, certificate, buyer),
    saleTerms(state, companyId, shares) {
        if (!getCompany(state, companyId).operated)
            return 'Shares cannot be sold until the company has operated.'
        return EighteenSeventeenCompanyMarket.marketSale(state, companyId, shares)
    },
    // Bankruptcies lower the limit to that of the players left, never below three players'.
    certificateLimit(state) {
        const limit = EighteenSeventeenCertificateLimits[Math.max(3, solventPlayerCount(state))]
        assertExists(limit, 'Unsupported 1817 player count')
        return limit
    },
    certificateWeight: (_state, certificate) =>
        certificate.kind === 'private' ? 0 : standardCertificateWeight(certificate),
    ownershipLimit(state, companyId) {
        return companyShareCount(state, EighteenSeventeenCharters, companyId) === 2 ? 100 : 60
    },
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    afterSale: (state) => EighteenSeventeenCompanyMarket.closeMarketShortsAgainstPool(state),
    turnOrder: 'sell-buy',
    repeatSales: 'separate',
    companyAuction: EighteenSeventeenCompanyAuction
}
