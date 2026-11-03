import { assertExists } from '@tabletop/common'
import {
    OwnershipExcess,
    PriceProtectionProcedure,
    ShareRedemptionProcedure,
    allSharesHeld,
    floatedCompaniesInMarketOrder,
    getCompany,
    ipoMarketTrading,
    marketZoneHoldingLimits,
    playerOrderAfterLastTurn,
    playersAfterPresident,
    soldThisStockRound,
    type OperatingRules,
    type StockRoundRules,
    type StockRules
} from '@tabletop/18xx'
import { Charters1870, CompanyIds1870 } from './companies.js'
import { requireState1870, type HydratedState1870 } from './state.js'
import { LedgeMarket1870, Market1870, reissueParForPrice } from './stockMarket.js'
import { Phases1870 } from './trains.js'

const IpoPoolId = 'initial-offering'
const MarketPoolId = 'open-market'
const OwnershipPercent = 60

export const StockRoundRules1870: StockRoundRules = {
    passing: 'consecutive',
    nextPlayerOrder: playerOrderAfterLastTurn,
    // A company rises when players and its own treasury hold every share (p. 8).
    soldOut: (state, companyId) =>
        getCompany(state, companyId).floated === true &&
        allSharesHeld(
            state,
            companyId,
            (certificate) =>
                certificate.owner.kind === 'player' ||
                (certificate.owner.kind === 'company' && certificate.owner.companyId === companyId)
        )
}

export const OperatingRules1870: OperatingRules = {
    charters: Charters1870,
    roundCount: (state) => Phases1870.phase(state.phaseId).operatingRounds,
    companyOrder: (state) => floatedCompaniesInMarketOrder(Market1870, state)
}

// A holding above 60%, gained by protecting a price, is kept until its holder next sells that
// company, when they must sell down to 60% (p. 13).
export const OwnershipExcess1870 = new OwnershipExcess({
    market: Market1870,
    charters: Charters1870,
    percent: OwnershipPercent,
    freeColors: ['green', 'brown']
})

const Trading = ipoMarketTrading({
    market: Market1870,
    charters: Charters1870,
    ipoPoolId: IpoPoolId,
    marketPoolId: MarketPoolId,
    marketLimit: 50
})

// A president who sold the company this stock round may not protect it, and the president a sale
// makes may not protect that sale (pp. 13, 16).
export const PriceProtection1870 = new PriceProtectionProcedure<HydratedState1870>({
    market: LedgeMarket1870,
    stockRules: () => StockRules1870,
    companyOrder: (state) => OperatingRules1870.companyOrder(state),
    requireState: requireState1870,
    ownershipCeiling: (state, companyId) => OwnershipExcess1870.ceiling(state, companyId),
    newPresidentProtects: false,
    mayProtect: (state, companyId, playerId) =>
        state.stockRound.completed ||
        !soldThisStockRound(state.stockRound, { kind: 'player', playerId }, companyId)
})

/** The par reissued shares sell at: the higher of the old par and the reissue table's (p. 18). */
export function reissueParPrice(state: HydratedState1870, companyId: string): number {
    const parPrice = getCompany(state, companyId).parPrice
    assertExists(parPrice, 'A reissuing company has a par price')
    const price = Market1870.companySpace(state.stockMarket, companyId).price
    return Math.max(parPrice, reissueParForPrice(price))
}

// A company that has operated redeems one share a stock round, and reissues only with no shares
// on the initial offering display (pp. 16-17).
export const ShareRedemption1870 = new ShareRedemptionProcedure<HydratedState1870>({
    market: Market1870,
    charters: Charters1870,
    roundRules: StockRoundRules1870,
    stockRules: () => StockRules1870,
    requireState: requireState1870,
    mayRedeem: (company) => !!company.operated,
    redemptionsPerRound: () => 1,
    reissueParPrice,
    reissueNeedsEmptyOffering: true
})

// A reissued share's price goes to its company, which may not spend it this stock round (p. 17).
const purchaseTerms: StockRules['purchaseTerms'] = (state, certificate, buyer) => {
    const terms = Trading.purchaseTerms(state, certificate, buyer)
    if (
        typeof terms === 'string' ||
        !ShareRedemption1870.isReissuedShare(state, certificate.companyId, certificate.poolId)
    )
        return terms
    return { ...terms, recipient: { kind: 'company', companyId: certificate.companyId } }
}

// A holding above 60% sells down in the block that first sells it, a forced sale too, as the
// normal share limits still apply (pp. 13, 23).
export const ShareTrading1870 = {
    purchaseTerms,
    stockSaleTerms: OwnershipExcess1870.withSellDown(
        LedgeMarket1870.withSaleDescent(Trading.stockSaleTerms)
    ),
    emergencySaleTerms: OwnershipExcess1870.withSellDown(
        LedgeMarket1870.withSaleDescent(Trading.emergencySaleTerms)
    )
}

const HoldingLimits = marketZoneHoldingLimits({
    market: Market1870,
    charters: Charters1870,
    certificateFreeColors: ['yellow', 'green', 'brown', 'black'],
    ownershipFreeColors: ['green', 'brown'],
    ownershipPercent: OwnershipPercent
})
// The designer's rule rather than Mayfair's p. 6: a holding above 60% stays, wherever the price goes,
// until its holder next sells that company.
const HeldExcessLimit = OwnershipExcess1870.withHeldExcess(HoldingLimits.ownershipLimit)

// Certificate limits by player count, for ten and for nine companies; the limit falls when a
// company closes and then stays (p. 7, p. 31). Seven players are from the designer's own table.
const CertificateLimits: Readonly<Record<number, readonly [number, number]>> = {
    2: [28, 24],
    3: [20, 17],
    4: [16, 14],
    5: [13, 11],
    6: [11, 9],
    7: [9, 7]
}

export type CertificateLimitState = Pick<HydratedState1870, 'companies' | 'players'>

export function tableCertificateLimit(state: CertificateLimitState): number {
    const limits = CertificateLimits[state.players.length]
    assertExists(limits, 'Unsupported 1870 player count')
    const closed = state.companies.some(
        (company) => CompanyIds1870.includes(company.id) && company.closed
    )
    return limits[closed ? 1 : 0]
}

export const StockRules1870: StockRules = {
    market: Market1870,
    round: StockRoundRules1870,
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms: ShareTrading1870.purchaseTerms,
    saleTerms: ShareTrading1870.stockSaleTerms,
    certificateLimit: (state) => tableCertificateLimit(requireState1870(state)),
    ...HoldingLimits,
    // A seller need not consider that a president may protect their sales (p. 14).
    certificateWeight: (state, certificate) =>
        HoldingLimits.certificateWeight(
            PriceProtection1870.sellerLimitState(state, certificate.owner),
            certificate
        ),
    ownershipLimit: (state, companyId, owner) =>
        HeldExcessLimit(PriceProtection1870.sellerLimitState(state, owner), companyId, owner),
    afterSale: (state, details) => PriceProtection1870.recordSale(state, details),
    holdsMarketMove: (state, sale, seller) => PriceProtection1870.holdsMove(state, sale, seller),
    afterSharePurchase: (state, details) => ShareRedemption1870.lockProceeds(state, details),
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    turnOrder: 'sell-buy-or-buy-sell',
    // A player may buy a private from another at any agreed price (p. 8).
    privateSales: { priceRange: () => ({ minimum: 1 }) },
    // A player may buy any number of open-market shares of one brown company in a turn, or a
    // single share from the initial offering, not both (p. 7).
    multipleBuys: {
        allowsAnother: (state, certificate, earlier) =>
            certificate.poolId === MarketPoolId &&
            earlier.every((purchase) => purchase.poolId === MarketPoolId) &&
            Market1870.companySpace(state.stockMarket, certificate.companyId).color === 'brown'
    }
}
