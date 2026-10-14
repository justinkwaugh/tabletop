import { assertExists } from '@tabletop/common'
import {
    certificatesInPool,
    certificatesOwnedBy,
    getCompany,
    sameOwner,
    sharesOwned,
    type Owner,
    type Portfolio,
    type President
} from '../finance/finance.js'
import type { CompanyAuctionRules } from './companyAuction.js'
import type { PrivateSaleRules } from './privateSale.js'
import type { ShareCertificate, SharePurchaseDetails, SharePurchaseTerms } from './sharePurchase.js'
import type { StockInstructionRules } from './stockInstruction.js'
import type { StockMarketChart } from './stockMarket.js'
import type { StockRoundRules } from './stockRoundRules.js'
import type { ShareSaleDetails } from './shareSale.js'
import type { StockState } from './stockState.js'
import type { MultipleBuyRules } from './turnPurchases.js'

export type ShareSaleTerms = {
    payer: Owner
    price: number
    destinationPoolId: string
    marketLimit: number
    maximumShares: number
    movement: number
    direction: string
}
export interface StockRules {
    market: StockMarketChart
    round: StockRoundRules
    instructions?: StockInstructionRules
    sellers(state: StockState, playerId: string): Owner[]
    buyers(state: StockState, playerId: string): Owner[]
    purchaseTerms(
        state: StockState,
        certificate: ShareCertificate,
        buyer: Owner
    ): SharePurchaseTerms | string
    saleTerms(
        state: StockState,
        companyId: string,
        shares: number,
        seller: Owner
    ): ShareSaleTerms | string
    certificateLimit(state: StockState, buyer: Owner): number
    certificateWeight(state: StockState, certificate: Portfolio[number]): number
    ownershipLimit(state: StockState, companyId: string, buyer: Owner): number
    presidencyCandidates(state: StockState, companyId: string): President[]
    /**
     * Whether a new president exchanges their largest ordinary certificates first, as 1832's
     * vice-president's certificates must be included.
     */
    presidencyExchangeLargestFirst?: boolean
    /**
     * What follows any sale into the market, such as the market closing its own shorts. Sale
     * previews may run it on a shallow copy of the state, so it replaces nested state it changes.
     */
    afterSale?(state: StockState, details: ShareSaleDetails): void
    /** What follows a share purchase on a stock turn, such as recording a company's proceeds. */
    afterSharePurchase?(state: StockState, details: SharePurchaseDetails): void
    /** When a turn's sales may come relative to its purchase. */
    turnOrder: 'sell-buy' | 'sell-buy-or-buy-sell' | 'sell-buy-sell'
    /**
     * A second sale of a company in the same turn: extending the first block at its price, or
     * a separate sale at the current price. Without it, each company sells once per turn.
     */
    repeatSales?: 'extend-block' | 'separate'
    /** Further share purchases in a turn after the first. */
    multipleBuys?: MultipleBuyRules
    /** Private sales between players, offered and answered like a company's purchase offer. */
    privateSales?: PrivateSaleRules
    /** Companies are started by auction during a stock turn rather than at a chosen par. */
    companyAuction?: CompanyAuctionRules
}
export function stockCertificateCount(state: StockState, owner: Owner, rules: StockRules): number {
    return certificatesOwnedBy(state, owner).reduce(
        (sum, certificate) => sum + rules.certificateWeight(state, certificate),
        0
    )
}
export function purchaseOwnershipCeiling(
    state: StockState,
    companyId: string,
    buyer: Owner,
    rules: Pick<StockRules, 'ownershipLimit'>
): number {
    const company = getCompany(state, companyId)
    assertExists(company.shareCount, 'Ownership limits require a share count')
    return Math.floor((rules.ownershipLimit(state, companyId, buyer) * company.shareCount) / 100)
}

export function certificateLimitAllows(
    state: StockState,
    owner: Owner,
    certificate: Portfolio[number],
    rules: StockRules
): boolean {
    const weight = rules.certificateWeight(state, certificate)
    return (
        weight === 0 ||
        stockCertificateCount(state, owner, rules) + weight <= rules.certificateLimit(state, owner)
    )
}

export function purchasableShares(
    state: StockState,
    poolId: string,
    companyId: string,
    buyer: Owner,
    rules: StockRules
): { certificate: ShareCertificate; price: number }[] {
    return certificatesInPool(state, poolId).flatMap((certificate) => {
        if (
            certificate.kind !== 'share' ||
            certificate.companyId !== companyId ||
            certificate.president
        )
            return []
        const terms = rules.purchaseTerms(state, certificate, buyer)
        return typeof terms === 'string' ? [] : [{ certificate, price: terms.price }]
    })
}

export function exceedsStockLimits(state: StockState, owner: Owner, rules: StockRules): boolean {
    return (
        stockCertificateCount(state, owner, rules) > rules.certificateLimit(state, owner) ||
        state.companies.some((company) => {
            if (!company.shareCount) return false
            return (
                sharesOwned(state, company.id, owner) * 100 >
                Math.max(
                    rules.ownershipLimit(state, company.id, owner) * company.shareCount,
                    ...(state.ownershipLimitExemptions ?? [])
                        .filter(
                            (exemption) =>
                                exemption.companyId === company.id &&
                                sameOwner(exemption.owner, owner)
                        )
                        .map((exemption) => exemption.maximumShares * 100)
                )
            )
        })
    )
}

export function marketSaleTerms(
    market: StockMarketChart,
    state: Pick<StockState, 'stockMarket'>,
    companyId: string,
    terms: Pick<ShareSaleTerms, 'destinationPoolId' | 'marketLimit' | 'maximumShares' | 'movement'>
): ShareSaleTerms {
    return {
        payer: { kind: 'bank' },
        price: market.companySpace(state.stockMarket, companyId).price,
        direction: 'down',
        ...terms
    }
}
