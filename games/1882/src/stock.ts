import { assertExists } from '@tabletop/common'
import {
    allSharesHeld,
    companyCharters,
    fullCapitalizationCompanyRules,
    ipoMarketTrading,
    marketZoneHoldingLimits,
    playerOrderAfterLastTurn,
    playersAfterPresident,
    type CompanyRules,
    type StockRoundRules,
    type StockRules
} from '@tabletop/18xx'
import { CnId, Majors1882, Privates1882, ScrId } from './companies.js'
import { IpoPoolId1882, MarketPoolId1882 } from './names.js'
import { neutralStationOnBoard } from './neutralStations.js'
import { Market1882 } from './stockMarket.js'

export const Charters1882 = companyCharters(() => ({
    shareCounts: Object.fromEntries(Majors1882.map((company) => [company.id, 10])),
    privateRevenues: Object.fromEntries(
        Privates1882.map((company) => [company.id, company.revenue])
    )
}))

export const ShareTrading1882 = ipoMarketTrading({
    market: Market1882,
    charters: Charters1882,
    ipoPoolId: IpoPoolId1882,
    marketPoolId: MarketPoolId1882,
    marketLimit: 50
})

/** Certificate limits by player count (§10.1). */
const CertificateLimits: Readonly<Record<number, number>> = { 2: 20, 3: 14, 4: 11, 5: 10, 6: 9 }

export const StockRoundRules1882: StockRoundRules = {
    passing: 'consecutive',
    nextPlayerOrder: playerOrderAfterLastTurn,
    // A company wholly held by players rises at the round's end (§10.6).
    soldOut: (state, companyId) =>
        allSharesHeld(state, companyId, (certificate) => certificate.owner.kind === 'player')
}

export const StockRules1882: StockRules = {
    market: Market1882,
    round: StockRoundRules1882,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms: ShareTrading1882.purchaseTerms,
    saleTerms: ShareTrading1882.stockSaleTerms,
    certificateLimit(state) {
        const limit = CertificateLimits[state.players.length]
        assertExists(limit, 'Unsupported 1882 player count')
        return limit
    },
    // Yellow, orange and brown shares are free of the certificate limit, orange and brown of the
    // 60% limit (§10.1, AAG errata).
    ...marketZoneHoldingLimits({
        market: Market1882,
        charters: Charters1882,
        certificateFreeColors: ['yellow', 'orange', 'brown'],
        ownershipFreeColors: ['orange', 'brown'],
        ownershipPercent: 60
    }),
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    turnOrder: 'sell-buy-sell',
    repeatSales: 'separate',
    // Brown-zone shares may be bought several at a time from the IPO and the pool (§10.1).
    multipleBuys: {
        allowsAnother: (state, certificate) =>
            Market1882.companySpace(state.stockMarket, certificate.companyId).color === 'brown'
    }
}

const FullCapitalization = fullCapitalizationCompanyRules({
    market: Market1882,
    charters: Charters1882,
    ipoPoolId: IpoPoolId1882,
    parSpaceColor: 'pink',
    floatPercent: 60
})

/**
 * The SCR starts only from the Saskatchewan Central (§7.1.2); the CN's president's certificate
 * may be bought only while a neutral station is on the board (§10.4).
 */
export function startRestriction(
    state: Parameters<CompanyRules['startTerms']>[0],
    companyId: string
): string | undefined {
    if (companyId === ScrId)
        return 'The Saskatchewan Central Railway starts only by exchanging its private company.'
    if (companyId === CnId && !neutralStationOnBoard(state))
        return 'The Canadian National starts only while a neutral station is on the board.'
    return undefined
}

export const CompanyRules1882: CompanyRules = {
    ...FullCapitalization,
    startTerms(state, companyId, buyer, marketSpaceId) {
        return (
            startRestriction(state, companyId) ??
            FullCapitalization.startTerms(state, companyId, buyer, marketSpaceId)
        )
    },
    parAfterAward: true
}
