import { assertExists } from '@tabletop/common'
import type { CompanyCharters } from '../company/companyCharters.js'
import { getCompany } from '../finance/finance.js'
import { presidentTrainFundingRules } from '../funding/presidentTrainFunding.js'
import type { TrainFundingRules } from '../funding/trainFunding.js'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import { floatedCompaniesInMarketOrder, type OperatingRules } from '../operating/operatingSet.js'
import type { PhaseTable } from '../phases/phaseTable.js'
import { ipoMarketTrading } from './ipoMarketTrading.js'
import { marketZoneHoldingLimits } from './marketZoneLimits.js'
import { OwnershipExcess } from './ownershipExcess.js'
import { playersAfterPresident } from './presidency.js'
import {
    PriceProtectionProcedure,
    type PriceProtectionRules,
    type PriceProtectionState
} from './priceProtection.js'
import {
    ShareRedemptionProcedure,
    type ShareRedemptionRules,
    type ShareRedemptionState
} from './shareRedemption.js'
import type { SoftLedgeMarket } from './softLedgeMarket.js'
import { allSharesHeld, playerOrderAfterLastTurn, type StockRoundRules } from './stockRoundRules.js'
import type { PrivateSaleRules } from './privateSale.js'
import type { StockRules } from './stockRules.js'

const IpoPoolId = 'initial-offering'
const MarketPoolId = 'open-market'
const OwnershipPercent = 60

type PriceProtectedState = HydratedEighteenXXState & PriceProtectionState & ShareRedemptionState

export type PriceProtectedStockOptions<State extends PriceProtectedState> = {
    ledgeMarket: SoftLedgeMarket
    charters: CompanyCharters
    companyIds: readonly string[]
    phases: PhaseTable
    requireState(state: object): State
    /** The certificate limit by player count: with every company open, then after a closure. */
    certificateLimits: Readonly<Record<number, readonly [number, number]>>
    reissueParForPrice(price: number): number
    reissueNeedsEmptyOffering: boolean
    mayRedeem: ShareRedemptionRules<State>['mayRedeem']
    mayProtect?: PriceProtectionRules<State>['mayProtect']
    /** Whether a player may sell a private to another now; at any agreed price of at least $1. */
    privateSalesOpen?(state: State): boolean
    privateIncomeRecipient?: OperatingRules['privateIncomeRecipient']
}

/**
 * The designer's stock market as 1850 and 1870 share it: full capitalisation on a soft ledge,
 * presidents protecting prices, companies redeeming and reissuing, holdings above 60% kept until
 * their holder next sells that company, and certificate-free zones.
 */
export function priceProtectedStock<State extends PriceProtectedState>(
    options: PriceProtectedStockOptions<State>
) {
    const { ledgeMarket, charters, companyIds, phases, requireState, certificateLimits } = options
    const market = ledgeMarket.chart

    const roundRules: StockRoundRules = {
        passing: 'consecutive',
        nextPlayerOrder: playerOrderAfterLastTurn,
        soldOut: (state, companyId) =>
            getCompany(state, companyId).floated === true &&
            allSharesHeld(
                state,
                companyId,
                (certificate) =>
                    certificate.owner.kind === 'player' ||
                    (certificate.owner.kind === 'company' &&
                        certificate.owner.companyId === companyId)
            )
    }

    const operatingRules: OperatingRules = {
        charters,
        roundCount: (state) => phases.phase(state.phaseId).operatingRounds,
        companyOrder: (state) => floatedCompaniesInMarketOrder(market, state),
        ...(options.privateIncomeRecipient
            ? { privateIncomeRecipient: options.privateIncomeRecipient }
            : {})
    }

    const ownershipExcess = new OwnershipExcess({
        market,
        charters,
        percent: OwnershipPercent,
        freeColors: ['green', 'brown']
    })

    const trading = ipoMarketTrading({
        market,
        charters,
        ipoPoolId: IpoPoolId,
        marketPoolId: MarketPoolId,
        marketLimit: 50
    })

    const priceProtection = new PriceProtectionProcedure<State>({
        market: ledgeMarket,
        stockRules: () => stockRules,
        companyOrder: (state) => operatingRules.companyOrder(state),
        requireState,
        ownershipCeiling: (state, companyId) => ownershipExcess.ceiling(state, companyId),
        newPresidentProtects: false,
        ...(options.mayProtect ? { mayProtect: options.mayProtect } : {})
    })

    function reissueParPrice(state: State, companyId: string): number {
        const parPrice = getCompany(state, companyId).parPrice
        assertExists(parPrice, 'A reissuing company has a par price')
        const price = market.companySpace(state.stockMarket, companyId).price
        return Math.max(parPrice, options.reissueParForPrice(price))
    }

    const shareRedemption = new ShareRedemptionProcedure<State>({
        market,
        charters,
        roundRules,
        stockRules: () => stockRules,
        requireState,
        mayRedeem: options.mayRedeem,
        redemptionsPerRound: () => 1,
        reissueParPrice,
        reissueNeedsEmptyOffering: options.reissueNeedsEmptyOffering
    })

    const purchaseTerms: StockRules['purchaseTerms'] = (state, certificate, buyer) => {
        const terms = trading.purchaseTerms(state, certificate, buyer)
        if (
            typeof terms === 'string' ||
            !shareRedemption.isReissuedShare(state, certificate.companyId, certificate.poolId)
        )
            return terms
        return { ...terms, recipient: { kind: 'company', companyId: certificate.companyId } }
    }

    const shareTrading = {
        purchaseTerms,
        stockSaleTerms: ownershipExcess.withSellDown(
            ledgeMarket.withSaleDescent(trading.stockSaleTerms)
        ),
        emergencySaleTerms: ownershipExcess.withSellDown(
            ledgeMarket.withSaleDescent(trading.emergencySaleTerms)
        )
    }

    const holdingLimits = marketZoneHoldingLimits({
        market,
        charters,
        certificateFreeColors: ['yellow', 'green', 'brown', 'black'],
        ownershipFreeColors: ['green', 'brown'],
        ownershipPercent: OwnershipPercent
    })
    const heldExcessLimit = ownershipExcess.withHeldExcess(holdingLimits.ownershipLimit)

    function certificateLimit(state: Pick<State, 'companies' | 'players'>): number {
        const limits = certificateLimits[state.players.length]
        assertExists(limits, 'Unsupported player count')
        const closed = state.companies.some(
            (company) => companyIds.includes(company.id) && company.closed
        )
        return limits[closed ? 1 : 0]
    }

    const privateSales: PrivateSaleRules = {
        priceRange: (state) =>
            options.privateSalesOpen && !options.privateSalesOpen(requireState(state))
                ? undefined
                : { minimum: 1 }
    }

    const stockRules: StockRules = {
        market,
        round: roundRules,
        buyers: (_state, playerId) => [{ kind: 'player', playerId }],
        sellers: (_state, playerId) => [{ kind: 'player', playerId }],
        purchaseTerms: shareTrading.purchaseTerms,
        saleTerms: shareTrading.stockSaleTerms,
        certificateLimit: (state) => certificateLimit(requireState(state)),
        ...holdingLimits,
        certificateWeight: (state, certificate) =>
            holdingLimits.certificateWeight(
                priceProtection.sellerLimitState(state, certificate.owner),
                certificate
            ),
        ownershipLimit: (state, companyId, owner) =>
            heldExcessLimit(priceProtection.sellerLimitState(state, owner), companyId, owner),
        afterSale: (state, details) => priceProtection.recordSale(state, details),
        holdsMarketMove: (state, sale, seller) => priceProtection.holdsMove(state, sale, seller),
        afterSharePurchase: (state, details) => shareRedemption.lockProceeds(state, details),
        presidencyCandidates: (state, companyId) =>
            playersAfterPresident(state, companyId, state.turnManager.turnOrder),
        turnOrder: 'sell-buy-or-buy-sell',
        privateSales,
        multipleBuys: {
            allowsAnother: (state, certificate, earlier) =>
                certificate.poolId === MarketPoolId &&
                earlier.every((purchase) => purchase.poolId === MarketPoolId) &&
                market.companySpace(state.stockMarket, certificate.companyId).color === 'brown'
        }
    }

    const trainFundingRules: TrainFundingRules = presidentTrainFundingRules({
        companyOrder: operatingRules.companyOrder,
        saleTerms: shareTrading.emergencySaleTerms,
        stockRules,
        protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId,
        afterShareSale: (state, details) => priceProtection.recordSale(state, details)
    })

    return {
        roundRules,
        operatingRules,
        ownershipExcess,
        priceProtection,
        reissueParPrice,
        shareRedemption,
        shareTrading,
        certificateLimit,
        stockRules,
        trainFundingRules
    }
}
