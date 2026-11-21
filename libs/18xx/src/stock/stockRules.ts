import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import {
    certificatesInPool,
    certificatesOwnedBy,
    sameOwner,
    sharesOwned,
    type Owner,
    type Portfolio,
    type President
} from '../finance/finance.js'
import { companyShareCount, type CompanyCharters } from '../company/companyCharters.js'
import type { CompanyAuctionRules } from './companyAuction.js'
import type { PrivateSaleRules } from './privateSale.js'
import type { ShareCertificate, SharePurchaseDetails, SharePurchaseTerms } from './sharePurchase.js'
import type { StockInstructionRules } from './stockInstruction.js'
import type { StockMarketChart } from './stockMarket.js'
import type { StockRoundRules } from './stockRoundRules.js'
import type { PresidencyExchangeTerms } from './presidency.js'
import type { ShareSaleDetails, ShareSaleSettlement } from './shareSale.js'
import type { StockState } from './stockState.js'
import type { MultipleBuyRules } from './turnPurchases.js'

/** A change to every player's certificate limit, such as a company closing lowers it to. */
export const CertificateLimitChange = Type.Object(
    { from: Type.Integer({ minimum: 0 }), to: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export type CertificateLimitChange = Type.Static<typeof CertificateLimitChange>

/** How the title's new presidents make up the president's certificate's shares. */
export function presidencyExchangeTerms(
    rules: Pick<StockRules, 'presidencyExchange'>
): PresidencyExchangeTerms {
    return rules.presidencyExchange ?? {}
}

export type ShareSaleTerms = {
    payer: Owner
    price: number
    /**
     * What selling exactly these shares pays, where a share is worth no whole amount, as an
     * 18MEX NdM 5% unit, half a 10% share's price, the odd half rounded up (3.2(a)); otherwise
     * the price for each share.
     */
    proceeds?: number
    destinationPoolId: string
    marketLimit: number
    maximumShares: number
    movement: number
    direction: string
}
/**
 * A second sale of a company by the same seller in one turn or funding: extending the first
 * block at its price, or a separate sale at the current price. Without it, each company sells once.
 */
export type RepeatSales = 'extend-block' | 'separate'

export type StockTurnOrder = 'sell-buy' | 'sell-buy-or-buy-sell' | 'sell-buy-sell'

export interface StockRules {
    market: StockMarketChart
    charters: CompanyCharters
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
     * How a new president's certificates make up the president's certificate's shares: their
     * largest ordinary certificates first, as 1832's vice-president's certificates must be
     * included; or the outgoing president's choice where they hold the shares more than one way,
     * 1849's last certificate or two single ones (§9.5), the largest exchanged until they choose.
     */
    presidencyExchange?: PresidencyExchangeTerms
    /**
     * A president may sell below the president's certificate with no one to succeed them: the
     * certificate goes to the pool and the company has no president until someone claims it
     * (1862 §6.3, §8).
     */
    presidencyLapses?: true
    /**
     * Whether the company's shares carry no presidency at all, as 18RoyalGorge's steel and gold
     * companies, which issue ten single shares and never operate (SR-5, SR-6).
     */
    presidentless?(state: StockState, companyId: string): boolean
    /**
     * What follows any sale into the market, such as the market closing its own shorts. Sale
     * previews may run it on a shallow copy of the state, so it replaces nested state it changes.
     */
    afterSale?(state: StockState, details: ShareSaleDetails): void
    /**
     * Whether a sale leaves the company's marker where it is, for the title to move later, as
     * price protection in 1832, 1850 and 1870 waits for the president's decision. A held sale
     * records the space it was sold from as its destination, and later sales of the company
     * fetch the unmoved price. It sees the sale's certificates in the market, marker unmoved.
     */
    holdsMarketMove?(state: StockState, sale: ShareSaleSettlement, seller: Owner): boolean
    /**
     * Whether players' certificates in the company are for sale to other players, which
     * `purchaseTerms` then prices, as 18USA's president's shares past 60% (§17).
     */
    sellsFromPlayers?(state: StockState, companyId: string): boolean
    /** What follows a share purchase on a stock turn, such as recording a company's proceeds. */
    afterSharePurchase?(state: StockState, details: SharePurchaseDetails): void
    /**
     * The certificate taken out of play just before a stock turn's purchase of this one, as a
     * non-president's purchase from 18Chesapeake's two-player bank pool removes a pool share
     * (§14.3). Naming the bought certificate itself leaves the buyer nothing, for nothing, but
     * the turn's purchase is made.
     */
    purchaseRemoval?(
        state: StockState,
        certificate: ShareCertificate,
        buyer: Owner
    ): string | undefined
    /**
     * When a turn's sales may come relative to its purchase; by game where an option changes it,
     * as 18Chesapeake's Off the Rails allows sales after the purchase.
     */
    turnOrder: StockTurnOrder | ((state: StockState) => StockTurnOrder)
    /** A second sale of a company in the same turn. */
    repeatSales?: RepeatSales
    /** Further share purchases in a turn after the first. */
    multipleBuys?: MultipleBuyRules
    /**
     * Keeps the turn's purchases where a rule reads them though a turn has one purchase, as
     * 1856's shares bought in a turn limit its sales.
     */
    recordsTurnPurchases?: true
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
    rules: Pick<StockRules, 'ownershipLimit' | 'charters'>
): number {
    const shareCount = companyShareCount(state, rules.charters, companyId)
    assertExists(shareCount, 'Ownership limits require a share count')
    return Math.floor((rules.ownershipLimit(state, companyId, buyer) * shareCount) / 100)
}

/** The certificate limit of a title that has none. */
export const NoCertificateLimit = Number.MAX_SAFE_INTEGER

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
            const shareCount = companyShareCount(state, rules.charters, company.id)
            if (!shareCount) return false
            return (
                sharesOwned(state, company.id, owner) * 100 >
                Math.max(
                    rules.ownershipLimit(state, company.id, owner) * shareCount,
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
