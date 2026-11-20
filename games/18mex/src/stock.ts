import { assertExists } from '@tabletop/common'
import {
    allSharesHeld,
    applyPresidencyChange,
    evaluatePresidency,
    fullCapitalizationCompanyRules,
    getCompany,
    ipoMarketTrading,
    marketZoneHoldingLimits,
    playerOrderAfterLastTurn,
    playersAfterPresident,
    sharesStillToFloat,
    type CompanyRules,
    type FinancialState,
    type Owner,
    type PresidencyExchangeState,
    type PresidencyChange,
    type ShareSaleTerms,
    type StockRoundRules,
    type StockRules,
    type StockState
} from '@tabletop/18xx'
import { ChartersMex, NdmId, isMinorMex } from './companies.js'
import { IpoPoolIdMex, MarketPoolIdMex, TradeInPoolIdMex } from './names.js'
import { requireStateMex } from './state.js'
import { MarketMex } from './stockMarket.js'
import { PhasesMex, ThreeHalfPhaseId } from './trains.js'

const ShareTrading = ipoMarketTrading({
    market: MarketMex,
    charters: ChartersMex,
    ipoPoolId: IpoPoolIdMex,
    marketPoolId: MarketPoolIdMex,
    marketLimit: 50
})

const ZoneLimits = marketZoneHoldingLimits({
    market: MarketMex,
    charters: ChartersMex,
    certificateFreeColors: ['yellow'],
    ownershipFreeColors: [],
    ownershipPercent: 60
})

const CertificateLimits: Readonly<Record<number, number>> = { 3: 19, 4: 14, 5: 11 }

/** Whether NdM stock is still closed to players, before phase 3½ (5.1). */
export function ndmUnavailable(state: { phaseId: string }): boolean {
    return !PhasesMex.isAtLeast(state.phaseId, ThreeHalfPhaseId)
}

/**
 * What NdM units are worth at a 10% share's price: a 5% unit half of it, the odd half rounded
 * down when bought and up when sold (3.2(a), 3.2(c)(3)).
 */
export function ndmUnitsValue(units: number, price: number, rounding: 'up' | 'down'): number {
    const halves = units * price
    return rounding === 'up' ? Math.ceil(halves / 2) : Math.floor(halves / 2)
}

/** A sale drops the price a row for each full 10% sold; an odd 5% does not count (3.2(a)). */
function saleMovement(companyId: string, shares: number): number {
    return companyId === NdmId ? Math.floor(shares / 2) : shares
}

function withNdmTerms(
    terms: ShareSaleTerms | string,
    companyId: string,
    shares: number
): ShareSaleTerms | string {
    if (typeof terms === 'string') return terms
    const movement = saleMovement(companyId, shares)
    return companyId === NdmId
        ? { ...terms, movement, proceeds: ndmUnitsValue(shares, terms.price, 'up') }
        : { ...terms, movement }
}

function saleRestriction(state: StockState, companyId: string): string | undefined {
    if (isMinorMex(companyId)) return 'Minor companies can never be sold.'
    if (companyId === NdmId && ndmUnavailable(state))
        return 'NdM stock cannot be sold before phase 3½.'
    return undefined
}

export const StockRoundRulesMex: StockRoundRules = {
    passing: 'consecutive',
    nextPlayerOrder: playerOrderAfterLastTurn,
    // A major all of whose stock players own rises a row at the round's end; trade-in shares
    // stop it (3.6).
    soldOut: (state, companyId) =>
        !isMinorMex(companyId) &&
        allSharesHeld(state, companyId, (certificate) => certificate.owner.kind === 'player')
}

export const StockRulesMex: StockRules = {
    market: MarketMex,
    charters: ChartersMex,
    round: StockRoundRulesMex,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms(state, certificate, buyer) {
        if (certificate.companyId === NdmId && ndmUnavailable(state))
            return 'NdM stock cannot be bought before phase 3½.'
        const terms = ShareTrading.purchaseTerms(state, certificate, buyer)
        if (typeof terms === 'string' || certificate.companyId !== NdmId) return terms
        const company = getCompany(state, NdmId)
        const price =
            certificate.poolId === IpoPoolIdMex
                ? company.parPrice
                : MarketMex.companySpace(state.stockMarket, NdmId).price
        assertExists(price, 'An NdM share on sale has a price')
        return { ...terms, price: ndmUnitsValue(certificate.shares, price, 'down') }
    },
    // No sales in the first stock round, nor of a company whose president's certificate is
    // unsold; the open market holds at most half a company (3.2(a)).
    saleTerms(state, companyId, shares, seller) {
        return (
            saleRestriction(state, companyId) ??
            withNdmTerms(
                ShareTrading.stockSaleTerms(state, companyId, shares, seller),
                companyId,
                shares
            )
        )
    },
    certificateLimit(state) {
        const limit = CertificateLimits[state.players.length]
        assertExists(limit, 'Unsupported 18MEX player count')
        return limit + (requireStateMex(state).certificateLimitRaised ? 1 : 0)
    },
    // Yellow-zone stock and the NdM's 5% certificates are free of the limit; a president's
    // certificate, a minor's charter and a private count one each (3.3(b)).
    certificateWeight(state, certificate) {
        if (certificate.kind === 'share' && isMinorMex(certificate.companyId)) return 1
        if (
            certificate.kind === 'share' &&
            certificate.companyId === NdmId &&
            certificate.shares === 1
        )
            return 0
        return ZoneLimits.certificateWeight(state, certificate)
    },
    ownershipLimit: (state, companyId, buyer) =>
        isMinorMex(companyId) ? 100 : ZoneLimits.ownershipLimit(state, companyId, buyer),
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    turnOrder: 'sell-buy-or-buy-sell',
    repeatSales: 'separate',
    // Players sell privates to one another for any agreed price; minors never (3.2(b)).
    privateSales: { priceRange: () => ({ minimum: 1 }) }
}

/** Re-reads a company's presidency after its certificates move, seats after the president first. */
export function reassessPresidencyMex(
    state: FinancialState & PresidencyExchangeState & { turnManager: { turnOrder: string[] } },
    companyId: string
): PresidencyChange | undefined {
    const change = evaluatePresidency(
        state,
        companyId,
        playersAfterPresident(state, companyId, state.turnManager.turnOrder)
    ).change
    if (change) applyPresidencyChange(state, change)
    return change
}

/** The emergency sales of a president raising cash for a train (4.3.4.2(d)). */
export function emergencySaleTermsMex(
    state: StockState,
    companyId: string,
    shares: number,
    seller: Owner
): ShareSaleTerms | string {
    return (
        saleRestriction(state, companyId) ??
        withNdmTerms(
            ShareTrading.emergencySaleTerms(state, companyId, shares, seller),
            companyId,
            shares
        )
    )
}

const FullCapitalization = fullCapitalizationCompanyRules({
    market: MarketMex,
    charters: ChartersMex,
    ipoPoolId: IpoPoolIdMex,
    parSpaceColor: 'pink',
    floatPercent: 50
})

export const CompanyRulesMex: CompanyRules = {
    ...FullCapitalization,
    // Any major's president's certificate may be bought from the Initial Offering; the NdM's
    // only from phase 3½, it coming otherwise with the MNR (3.2(c)(1), 5.1).
    startMarketSpaces: (state, companyId) =>
        isMinorMex(companyId) || (companyId === NdmId && ndmUnavailable(state))
            ? []
            : FullCapitalization.startMarketSpaces(state, companyId),
    awardParSpaces: (state) => FullCapitalization.startMarketSpaces(state, NdmId),
    startTerms(state, companyId, buyer, marketSpaceId) {
        const terms = FullCapitalization.startTerms(state, companyId, buyer, marketSpaceId)
        if (typeof terms === 'string' || companyId !== NdmId) return terms
        return { ...terms, price: MarketMex.space(marketSpaceId).price * 2 }
    },
    // A major floats once half its stock has left the Initial Offering, the trade-in box part of
    // it (3.4).
    sharesToFloat: (state, companyId) =>
        sharesStillToFloat(
            state,
            ChartersMex,
            companyId,
            50,
            (certificate) =>
                certificate.poolId === IpoPoolIdMex || certificate.poolId === TradeInPoolIdMex
        ),
    // It receives ten times its par, the NdM's ten 10% shares as any major's (3.4(c)).
    flotationPayments(state, companyId) {
        if (CompanyRulesMex.sharesToFloat?.(state, companyId) !== 0) return undefined
        const company = getCompany(state, companyId)
        if (company.funded) return []
        assertExists(company.parPrice, 'A floating company has a par')
        return [
            {
                from: { kind: 'bank' },
                to: { kind: 'company', companyId },
                amount: company.parPrice * 10
            }
        ]
    },
    parAfterAward: true
}
