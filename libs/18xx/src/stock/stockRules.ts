import { assertExists } from '@tabletop/common'
import type { StockRoundRules } from './stockRoundRules.js'
import {
    sameOwner,
    certificatesInPool,
    certificatesOwnedBy,
    getCompany,
    sharesOwned,
    type Owner,
    type Portfolio,
    type President
} from '../finance/finance.js'
import { companyMarketSpace } from './stockMarket.js'
import type { StockState } from './stockState.js'
import type { SharePurchaseTerms, ShareCertificate } from './sharePurchase.js'
import type { StockInstructionRules } from './stockInstruction.js'

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
    extendSaleBlocks?: boolean
    sellAfterBuying: boolean
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
    rules: StockRules
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
    return (
        stockCertificateCount(state, owner, rules) + rules.certificateWeight(state, certificate) <=
        rules.certificateLimit(state, owner)
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
                    ...state.ownershipLimitExemptions
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
    state: Pick<StockState, 'stockMarket'>,
    companyId: string,
    terms: Pick<ShareSaleTerms, 'destinationPoolId' | 'marketLimit' | 'maximumShares' | 'movement'>
): ShareSaleTerms {
    return {
        payer: { kind: 'bank' },
        price: companyMarketSpace(state.stockMarket, companyId).price,
        direction: 'down',
        ...terms
    }
}
