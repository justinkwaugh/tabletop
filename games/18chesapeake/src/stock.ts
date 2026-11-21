import { assertExists } from '@tabletop/common'
import {
    allSharesHeld,
    companyCharters,
    fullCapitalizationCompanyRules,
    getCompany,
    ipoMarketTrading,
    marketZoneHoldingLimits,
    playerOrderAfterLastTurn,
    playersAfterPresident,
    presides,
    type CompanyRules,
    type StockRoundRules,
    type StockRules
} from '@tabletop/18xx'
import { MajorsChesapeake, PrivatesChesapeake } from './companies.js'
import { IpoPoolIdChesapeake, MarketPoolIdChesapeake } from './names.js'
import {
    OffTheRailsEditionChesapeake,
    StandardEditionChesapeake,
    editionChesapeake
} from './edition.js'
import { MarketChesapeake } from './stockMarket.js'

export const ChartersChesapeake = companyCharters(() => ({
    shareCounts: Object.fromEntries(MajorsChesapeake.map((company) => [company.id, 10])),
    privateRevenues: Object.fromEntries(
        PrivatesChesapeake.map((company) => [company.id, company.revenue])
    )
}))

export const ShareTradingChesapeake = ipoMarketTrading({
    market: MarketChesapeake,
    charters: ChartersChesapeake,
    ipoPoolId: IpoPoolIdChesapeake,
    marketPoolId: MarketPoolIdChesapeake,
    marketLimit: 50
})

/** The two-player variant's rules apply at a two-player table (§14). */
export function twoPlayer(state: { players: readonly unknown[] }): boolean {
    return state.players.length === 2
}

/** Certificate limits by player count (§10.1). */
const CertificateLimits: Readonly<Record<number, number>> = { 2: 20, 3: 20, 4: 16, 5: 13, 6: 11 }

export const StockRoundRulesChesapeake: StockRoundRules = {
    passing: 'consecutive',
    nextPlayerOrder: playerOrderAfterLastTurn,
    // A company wholly held by players rises at the round's end (§10.6); with two players, a
    // floated company with none of its shares in the bank pool (§14.4).
    soldOut(state, companyId) {
        if (!twoPlayer(state))
            return allSharesHeld(
                state,
                companyId,
                (certificate) => certificate.owner.kind === 'player'
            )
        return (
            !!getCompany(state, companyId).floated &&
            !state.certificates.some(
                (certificate) =>
                    certificate.companyId === companyId &&
                    certificate.poolId === MarketPoolIdChesapeake
            )
        )
    }
}

export const StockRulesChesapeake: StockRules = {
    market: MarketChesapeake,
    round: StockRoundRulesChesapeake,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms: ShareTradingChesapeake.purchaseTerms,
    saleTerms: ShareTradingChesapeake.stockSaleTerms,
    certificateLimit(state) {
        const limit = CertificateLimits[state.players.length]
        assertExists(limit, 'Unsupported 18Chesapeake player count')
        return limit
    },
    // Yellow-zone shares are free of the certificate limit; no one may hold more than 60% (§10.1).
    // Off the Rails adds orange and brown zones, free of the limit and of the 60% cap.
    ...marketZoneHoldingLimits({
        market: MarketChesapeake,
        charters: ChartersChesapeake,
        certificateFreeColors: ['yellow', 'orange', 'brown'],
        ownershipFreeColors: ['orange', 'brown'],
        ownershipPercent: 60
    }),
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    turnOrder: (state) => editionChesapeake(state).turnOrder,
    repeatSales: 'separate',
    // With two players, a purchase from the bank pool by anyone but the president first takes
    // a pool share out of the game: another, or the only one, leaving the buyer nothing (§14.3).
    purchaseRemoval(state, certificate, buyer) {
        if (!twoPlayer(state) || certificate.poolId !== MarketPoolIdChesapeake) return undefined
        if (presides(state, certificate.companyId, buyer)) return undefined
        const pool = state.certificates.filter(
            (entry) =>
                entry.companyId === certificate.companyId &&
                entry.kind === 'share' &&
                entry.poolId === MarketPoolIdChesapeake
        )
        return (pool.findLast((entry) => entry.id !== certificate.id) ?? certificate).id
    },
    // Off the Rails's brown zone allows several shares of the company in one purchase, from the
    // IPO and the bank pool.
    multipleBuys: {
        allowsAnother: (state, certificate) =>
            MarketChesapeake.companySpace(state.stockMarket, certificate.companyId).color ===
            'brown'
    }
}

const Capitalization = new Map(
    [StandardEditionChesapeake, OffTheRailsEditionChesapeake].map((edition) => [
        edition,
        fullCapitalizationCompanyRules({
            market: MarketChesapeake,
            charters: ChartersChesapeake,
            ipoPoolId: IpoPoolIdChesapeake,
            parSpaceColor: 'pink',
            floatPercent: edition.floatPercent
        })
    ])
)
function capitalization(state: object): CompanyRules {
    const rules = Capitalization.get(editionChesapeake(state))
    assertExists(rules, 'Every edition capitalizes its companies')
    return rules
}

export const CompanyRulesChesapeake: CompanyRules = {
    // Companies start at the par spaces of the edition's own market: $70, $80 and $95, or Off the
    // Rails's $67 to $100. They float at 60% sold, or 50% with Off the Rails.
    startMarketSpaces: (state) =>
        editionChesapeake(state)
            .market.spaces.filter((space) => space.color === 'pink')
            .map((space) => space.id),
    startTerms: (state, companyId, buyer, marketSpaceId) =>
        capitalization(state).startTerms(state, companyId, buyer, marketSpaceId),
    sharesToFloat: (state, companyId) => capitalization(state).sharesToFloat?.(state, companyId),
    flotationPayments: (state, companyId) =>
        capitalization(state).flotationPayments(state, companyId),
    // With two players, a company's unsold certificates go to the bank pool as it floats
    // (§14.2).
    onFloat(state, companyId) {
        if (!twoPlayer(state)) return
        for (const certificate of state.certificates)
            if (
                certificate.companyId === companyId &&
                certificate.owner.kind === 'bank' &&
                certificate.poolId === IpoPoolIdChesapeake
            )
                certificate.poolId = MarketPoolIdChesapeake
    },
    parAfterAward: true
}
