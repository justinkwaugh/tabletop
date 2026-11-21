import { assert, assertExists } from '@tabletop/common'
import { companyShareCount, type CompanyCharters } from '../company/companyCharters.js'
import { settleCashPayments, type CashPayment } from '../finance/cashPayments.js'
import {
    certificatesInPool,
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    presidentOf,
    sharesOwned,
    signedShares,
    treasuryPoolId,
    type FinancialState,
    type Owner
} from '../finance/finance.js'
import type { InterestDefault, LoanState } from '../loans/loans.js'
import { cancelShorts } from '../stock/shorts.js'
import {
    placeStockMarker,
    type StockMarket,
    type StockMarketChart,
    type StockMarketMove,
    type StockMarketSpace
} from '../stock/stockMarket.js'
import type { ShareCertificate, SharePurchaseTerms } from '../stock/sharePurchase.js'
import { marketSaleTerms, type ShareSaleTerms } from '../stock/stockRules.js'
import type { StockState } from '../stock/stockState.js'
import type { ClosingZone } from './sizedCompanyState.js'

/** A title's market for companies that change size, as the 1817 family's. */
export interface SizedCompanyMarketRules {
    market: StockMarketChart
    charters: CompanyCharters
    /** The pool that sales and shorts go to and buy-backs come from. */
    marketPoolId: string
    /** A charter's size before it starts and after it resets. */
    charterShareCount: number
    isLiquidationSpace(space: StockMarketSpace): boolean
    isAcquisitionSpace(space: StockMarketSpace): boolean
}

/**
 * The market of companies that change size: their sizes, the acquisition and liquidation zones,
 * the market pool and the share terms that follow from them.
 */
export class SizedCompanyMarket {
    constructor(readonly rules: SizedCompanyMarketRules) {}

    get chart(): StockMarketChart {
        return this.rules.market
    }

    shareCount(state: Pick<FinancialState, 'companies'>, companyId: string): number {
        const count = companyShareCount(state, this.rules.charters, companyId)
        assertExists(count, 'Every sized company has a share count')
        return count
    }

    price(state: Pick<StockState, 'stockMarket'>, companyId: string): number {
        return this.rules.market.companySpace(state.stockMarket, companyId).price
    }

    isLiquidated(market: StockMarket, companyId: string): boolean {
        return this.rules.isLiquidationSpace(this.rules.market.companySpace(market, companyId))
    }

    closingZone(market: StockMarket, companyId: string): ClosingZone | undefined {
        const space = this.rules.market.companySpace(market, companyId)
        if (this.rules.isLiquidationSpace(space)) return 'liquidation'
        if (this.rules.isAcquisitionSpace(space)) return 'acquisition'
        return undefined
    }

    /** Shares of a company in the acquisition or liquidation zone cannot be bought or sold. */
    inClosingZone(market: StockMarket, companyId: string): boolean {
        return this.closingZone(market, companyId) !== undefined
    }

    /** The floated companies in a closing zone, and which. */
    closingZones(
        state: Pick<StockState, 'stockMarket' | 'companies'>
    ): { companyId: string; zone: ClosingZone }[] {
        return state.companies.flatMap((company) => {
            const zone = company.floated
                ? this.closingZone(state.stockMarket, company.id)
                : undefined
            return zone ? [{ companyId: company.id, zone }] : []
        })
    }

    /** Moves a started company to the liquidation space, where it stops operating. */
    liquidate(state: StockState, companyId: string): StockMarketMove {
        assert(getCompany(state, companyId).started, 'Only a started company is liquidated')
        const { market } = this.rules
        const from = market.companySpace(state.stockMarket, companyId)
        const to = market.spaces.find((space) => this.rules.isLiquidationSpace(space))
        assertExists(to, 'The market has a liquidation space')
        placeStockMarker(state.stockMarket, companyId, to.id)
        return { companyId, fromMarketSpaceId: from.id, toMarketSpaceId: to.id }
    }

    /** The company is liquidated and its cash goes to the president, who owes the interest. */
    liquidationInterestDefault(state: LoanState, companyId: string, owed: number): InterestDefault {
        const president = controllingOwner(state, companyId)
        assertExists(president, 'A borrowing company has a president')
        const marketMove = this.liquidate(state, companyId)
        const company = { kind: 'company' as const, companyId }
        const treasury = finiteCashOwnedBy(state, company)
        const payments: CashPayment[] = []
        if (treasury) payments.push({ from: company, to: { ...president }, amount: treasury })
        settleCashPayments(state, payments)
        const paid = Math.min(owed, finiteCashOwnedBy(state, president))
        if (paid) {
            const payment = { from: { ...president }, to: { kind: 'bank' as const }, amount: paid }
            settleCashPayments(state, [payment])
            payments.push(payment)
        }
        return { payments, marketMoves: [marketMove], unpaid: owed - paid }
    }

    marketPool(state: Pick<FinancialState, 'certificatePools'>) {
        const market = state.certificatePools.find((pool) => pool.id === this.rules.marketPoolId)
        assertExists(market, 'The title has a market pool')
        return market
    }

    /** After any sale, the market closes its shorts against its own shares. */
    closeMarketShortsAgainstPool(state: FinancialState): void {
        const market = this.marketPool(state)
        for (const company of state.companies) cancelShorts(state, company.id, market.owner)
    }

    /** A sale into the market, at no price drop, outside the acquisition and liquidation zones. */
    marketSale(state: StockState, companyId: string, shares: number): ShareSaleTerms | string {
        const company = getCompany(state, companyId)
        if (
            !companyShareCount(state, this.rules.charters, companyId) ||
            !presidentOf(state, companyId) ||
            company.closed
        )
            return 'This company has no saleable shares.'
        if (this.inClosingZone(state.stockMarket, companyId))
            return 'Shares in the acquisition or liquidation zone cannot be sold.'
        return marketSaleTerms(this.rules.market, state, companyId, {
            destinationPoolId: this.rules.marketPoolId,
            marketLimit: 1000,
            maximumShares: shares,
            movement: 0
        })
    }

    /** One share at the current price, from the market or the company's treasury. */
    purchaseTerms(
        state: StockState,
        certificate: ShareCertificate,
        buyer: Owner
    ): SharePurchaseTerms | string {
        const company = getCompany(state, certificate.companyId)
        if (!company.started || company.closed) return 'This company has not started or is closed.'
        if (certificate.president) return 'The president’s certificate is won by auction.'
        if (this.inClosingZone(state.stockMarket, company.id))
            return 'Shares in the acquisition or liquidation zone cannot be bought.'
        const market =
            certificate.owner.kind === 'bank' && certificate.poolId === this.rules.marketPoolId
        const treasury =
            certificate.owner.kind === 'company' &&
            certificate.owner.companyId === company.id &&
            certificate.poolId === treasuryPoolId(company.id)
        if (!market && !treasury) return 'This certificate is not available for purchase.'
        return {
            price: this.price(state, company.id) * certificate.shares,
            recipient: certificate.owner,
            payers: [buyer]
        }
    }

    /** A short issues an extra share, so a rival can pass a president holding half. */
    securePresidency(state: StockState, companyId: string, owner: Owner): boolean {
        return sharesOwned(state, companyId, owner) * 2 > this.shareCount(state, companyId)
    }

    /** The shares players hold, each player's net holding counting when positive. */
    playerHoldings(state: StockState, companyId: string): number {
        return state.players.reduce(
            (sum, player) =>
                sum +
                Math.max(
                    0,
                    sharesOwned(state, companyId, { kind: 'player', playerId: player.playerId })
                ),
            0
        )
    }

    /** A company larger than a charter whose players hold every share net. */
    soldOut(state: StockState, companyId: string): boolean {
        const count = this.shareCount(state, companyId)
        return (
            count > this.rules.charterShareCount && this.playerHoldings(state, companyId) >= count
        )
    }

    /** Whether players hold more than every share net, which a short squeeze rewards. */
    oversold(state: StockState, companyId: string): boolean {
        return this.playerHoldings(state, companyId) > this.shareCount(state, companyId)
    }

    /** The company's shares in the market pool, less the market's shorts, never below none. */
    marketPoolShares(state: StockState, companyId: string): number {
        return Math.max(
            0,
            certificatesInPool(state, this.rules.marketPoolId).reduce(
                (sum, certificate) =>
                    sum + (certificate.companyId === companyId ? signedShares(certificate) : 0),
                0
            )
        )
    }
}
