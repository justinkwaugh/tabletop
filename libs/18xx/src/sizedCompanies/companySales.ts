import { PassableBidding, isValidBidStep, turnOrderFrom } from '@tabletop/common'
import * as Type from 'typebox'
import {
    AssetTransfer,
    StationTransfer,
    moveCompanyStations,
    transferCompanyAssets
} from '../company/companyMerger.js'
import { resetCompany } from '../company/companyReset.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { controllingOwner, finiteCashOwnedBy, getCompany, sameOwner } from '../finance/finance.js'
import { shareholderPayout } from '../finance/shareholderPayout.js'
import { Debt, chargePlayers } from '../funding/cashCrisis.js'
import {
    LoanRecord,
    companyLoans,
    loansRemaining,
    repayLoan,
    takeLoan,
    type LoanRules
} from '../loans/loans.js'
import { closePrivate } from '../privates/privateCompany.js'
import type { StockMarketMove } from '../stock/stockMarket.js'
import { releaseTrains, trainsOwnedBy } from '../trains/train.js'
import { settleTrainDepartures } from '../trains/trainDepartures.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { CompanyConversions } from './companyConversions.js'
import type { SizedCompanyMarket } from './sizedCompanyMarket.js'
import {
    formerPresident,
    type Acquisition,
    type CompanySale,
    type ConversionRound,
    type HeldAside,
    type SaleKind,
    type SaleTerms,
    type SizedCompanyState
} from './sizedCompanyState.js'

type State = SizedCompanyState

/** A title's terms for selling its companies to one another in the acquisition round. */
export interface CompanySaleRules {
    market: SizedCompanyMarket
    conversions: CompanyConversions
    loanRules: LoanRules
    trainRules: TrainRules
    /** Bids rise in steps of this, and a company in a closing zone opens at one step. */
    increment: number
    /**
     * The bank's payment when another president's company buys the company, as 1817's Golden
     * Parachute's to its president.
     */
    acquisitionPayment?(state: State, companyId: string, buyerId: string): CashPayment | undefined
    /** The bank's payment when it liquidates the company, as 1817's Golden Parachute's. */
    liquidationPayment?(state: State, companyId: string): CashPayment | undefined
}

// The title's payment on an acquisition is stored as `parachute`, the name 1817 games use.
export const AcquisitionRecord = Type.Object(
    {
        price: Type.Integer({ minimum: 1 }),
        parachute: Type.Optional(CashPayment),
        treasuryPayment: Type.Optional(CashPayment),
        loans: Type.Array(LoanRecord),
        assets: AssetTransfer,
        stations: StationTransfer,
        payment: CashPayment,
        repayments: Type.Array(CashPayment)
    },
    { additionalProperties: false }
)
export type AcquisitionRecord = Type.Static<typeof AcquisitionRecord>

export const Settlement = Type.Object(
    {
        perShare: Type.Integer({ minimum: 0 }),
        payments: Type.Array(CashPayment),
        charges: Type.Array(Debt),
        paid: Type.Array(CashPayment)
    },
    { additionalProperties: false }
)
export type Settlement = Type.Static<typeof Settlement>

/**
 * Selling a company to another: liquidation, acquisition and friendly sales by auction among
 * the presidents' companies, the buyer's payment and loans, and the settlement of its holders.
 */
export class CompanySales {
    constructor(readonly rules: CompanySaleRules) {}

    /** Lowest price first, so the closing zones come before the companies that could buy. */
    roundCompanyIds(state: State): string[] {
        return this.rules.market.chart
            .order(state.stockMarket)
            .filter((companyId) => getCompany(state, companyId).floated)
            .reverse()
    }

    saleKind(state: State, companyId: string): SaleKind {
        return this.rules.market.closingZone(state.stockMarket, companyId) ?? 'offered'
    }

    /** A company that has moved into a closing zone since its operating round ended sits out. */
    enteredClosingZone(state: State, mergerRound: ConversionRound, companyId: string): boolean {
        const zone = this.rules.market.closingZone(state.stockMarket, companyId)
        const before = mergerRound.closingZones.find((entry) => entry.companyId === companyId)?.zone
        return !!zone && zone !== before
    }

    companyCash(state: State, companyId: string): number {
        return finiteCashOwnedBy(state, { kind: 'company', companyId })
    }

    openingBid(state: State, companyId: string, kind: SaleKind): number {
        const { increment, market } = this.rules
        if (kind !== 'offered') return increment
        const value = market.shareCount(state, companyId) * market.price(state, companyId)
        return Math.ceil(value / increment) * increment
    }

    /** The bank pays an offered company for the shares in its treasury. */
    treasuryCompensation(state: State, companyId: string, kind: SaleKind): number {
        return kind === 'offered'
            ? this.rules.conversions.treasuryShareIds(state, companyId).length *
                  this.rules.market.price(state, companyId)
            : 0
    }

    /** A liquidated company keeps its loans until its sale settles them; any other passes them on. */
    inheritedLoans(state: State, sale: SaleTerms): number {
        return sale.kind === 'liquidation' ? 0 : companyLoans(state, sale.companyId)
    }

    /**
     * The most a company could pay: its cash, the loans it may still take, and what it gains with
     * the target, less the target's loans it takes on.
     */
    buyerLimit(state: State, buyerId: string, sale: SaleTerms): number {
        const { loanRules } = this.rules
        const loans = Math.min(
            loanRules.capacity(state, buyerId) - companyLoans(state, buyerId),
            loansRemaining(state, loanRules) + this.inheritedLoans(state, sale)
        )
        return (
            this.companyCash(state, buyerId) +
            Math.max(loans, 0) * loanRules.value +
            this.companyCash(state, sale.companyId) +
            this.treasuryCompensation(state, sale.companyId, sale.kind) -
            this.inheritedLoans(state, sale) * loanRules.value
        )
    }

    private buyingCompanies(state: State, playerId: string, targetId: string): string[] {
        return state.companies
            .filter(
                (company) =>
                    company.id !== targetId &&
                    company.kind !== 'private' &&
                    !!company.floated &&
                    !this.rules.market.inClosingZone(state.stockMarket, company.id) &&
                    controllingOwner(state, company.id)?.playerId === playerId
            )
            .map((company) => company.id)
    }

    buyersFor(state: State, playerId: string, sale: SaleTerms, amount: number): string[] {
        return this.buyingCompanies(state, playerId, sale.companyId).filter(
            (buyerId) => this.buyerLimit(state, buyerId, sale) >= amount
        )
    }

    playerLimit(state: State, playerId: string, sale: SaleTerms): number {
        return Math.max(
            0,
            ...this.buyingCompanies(state, playerId, sale.companyId).map((buyerId) =>
                this.buyerLimit(state, buyerId, sale)
            )
        )
    }

    minimumBid(state: State, sale: CompanySale): number {
        const bidding = new PassableBidding(sale.bidding)
        return bidding.hasBid
            ? bidding.highBid + this.rules.increment
            : this.openingBid(state, sale.companyId, sale.kind)
    }

    /** A company's own president may bid only the minimum. */
    bidCeiling(state: State, sale: CompanySale, playerId: string): number {
        const limit = this.playerLimit(state, playerId, sale)
        return controllingOwner(state, sale.companyId)?.playerId === playerId
            ? Math.min(limit, this.minimumBid(state, sale))
            : limit
    }

    bidRejection(
        state: State,
        sale: CompanySale,
        playerId: string,
        amount: number
    ): string | undefined {
        const { increment } = this.rules
        if (new PassableBidding(sale.bidding).currentBidderId !== playerId)
            return 'It is not this player’s bid.'
        const minimum = this.minimumBid(state, sale)
        if (!isValidBidStep(amount, minimum, increment))
            return `Bid at least ${minimum}, in steps of ${increment}.`
        if (controllingOwner(state, sale.companyId)?.playerId === playerId && amount !== minimum)
            return 'A company’s own president may bid only the minimum.'
        if (amount > this.bidCeiling(state, sale, playerId))
            return 'None of the player’s companies can pay this.'
        return undefined
    }

    /**
     * Bidding starts left of the company's president, or of the president bankruptcy took from it,
     * among the players still in the game.
     */
    biddingOrder(state: State, companyId: string): string[] {
        const presidentId =
            controllingOwner(state, companyId)?.playerId ?? formerPresident(state, companyId)
        const { turnOrder } = state.turnManager
        if (!presidentId) return [...turnOrder]
        const seats = state.players.map((player) => player.playerId)
        const after = seats.indexOf(presidentId) + 1
        return [...seats.slice(after), ...seats.slice(0, after)].filter((id) =>
            turnOrder.includes(id)
        )
    }

    hasBidder(state: State, sale: SaleTerms): boolean {
        const opening = this.openingBid(state, sale.companyId, sale.kind)
        return state.turnManager.turnOrder.some(
            (playerId) => this.playerLimit(state, playerId, sale) >= opening
        )
    }

    /** Withdraws every bidder who cannot reach the next minimum. */
    withdrawUnableBidders(state: State, sale: CompanySale): CompanySale {
        return {
            ...sale,
            bidding: new PassableBidding(sale.bidding).withdrawBelow(
                this.minimumBid(state, sale),
                (id) => this.bidCeiling(state, sale, id)
            )
        }
    }

    perShareProceeds(state: State, companyId: string, amount: number): number {
        return Math.floor(amount / this.rules.market.shareCount(state, companyId))
    }

    /**
     * The buyer takes the sold company's assets and pays the bank, borrowing first for what it
     * lacks, before it takes on the sold company's loans. Those over its limit are repaid at once,
     * before it chooses to repay any others.
     */
    acquireCompany(
        state: State,
        sale: SaleTerms,
        buyerId: string,
        price: number
    ): AcquisitionRecord {
        const { loanRules, conversions } = this.rules
        const parachute = this.rules.acquisitionPayment?.(state, sale.companyId, buyerId)
        if (parachute) settleCashPayments(state, [parachute])
        const compensation = this.treasuryCompensation(state, sale.companyId, sale.kind)
        const treasuryPayment = compensation
            ? {
                  from: { kind: 'bank' as const },
                  to: { kind: 'company' as const, companyId: sale.companyId },
                  amount: compensation
              }
            : undefined
        if (treasuryPayment) settleCashPayments(state, [treasuryPayment])
        const loans: LoanRecord[] = []
        while (this.companyCash(state, buyerId) + this.companyCash(state, sale.companyId) < price)
            loans.push(takeLoan(state, loanRules, buyerId))
        const assets = transferCompanyAssets(state, sale.companyId, buyerId, {
            loans: this.inheritedLoans(state, sale) > 0
        })
        const stations = moveCompanyStations(state, sale.companyId, buyerId)
        conversions.rules.stations.trimStations(state, buyerId)
        const payment = {
            from: { kind: 'company' as const, companyId: buyerId },
            to: { kind: 'bank' as const },
            amount: price
        }
        settleCashPayments(state, [payment])
        const repayments: CashPayment[] = []
        while (
            companyLoans(state, buyerId) > loanRules.capacity(state, buyerId) &&
            this.companyCash(state, buyerId) >= loanRules.value
        )
            repayments.push(this.repayAcquiredLoan(state, buyerId).payment)
        return {
            price,
            ...(parachute ? { parachute } : {}),
            ...(treasuryPayment ? { treasuryPayment } : {}),
            loans,
            assets,
            stations,
            payment,
            repayments
        }
    }

    canRepayAcquiredLoan(state: State, acquisition: Acquisition): boolean {
        return (
            acquisition.repaidLoans < acquisition.inheritedLoans &&
            this.companyCash(state, acquisition.buyerId) >= this.rules.loanRules.value
        )
    }

    /** Repaying the loans an acquisition brings moves no price. */
    repayAcquiredLoan(state: State, buyerId: string): LoanRecord {
        const { repayMove: _repayMove, ...repaymentInPlace } = this.rules.loanRules
        return repayLoan(state, repaymentInPlace, buyerId)
    }

    /** Each inherited loan the buyer still holds moves its price as taking a loan does. */
    moveBuyerForUnpaidLoans(state: State, acquisition: Acquisition): StockMarketMove[] {
        const { loanRules } = this.rules
        const move = loanRules.takeMove
        if (!move) return []
        const chart = loanRules.marketFor?.(state) ?? loanRules.market
        const marketMoves: StockMarketMove[] = []
        for (let loan = acquisition.repaidLoans; loan < acquisition.inheritedLoans; loan++) {
            const marketMove = chart.moveCompanyMarker(
                state.stockMarket,
                acquisition.buyerId,
                move.direction,
                move.steps
            )
            if (marketMove) marketMoves.push(marketMove)
        }
        return marketMoves
    }

    // Charges are met in turn order from the sold company's president.
    private chargesInTurnOrder(state: State, companyId: string, charges: readonly Debt[]): Debt[] {
        const president = controllingOwner(state, companyId)?.playerId
        const order = president
            ? turnOrderFrom(state.turnManager.turnOrder, president)
            : state.turnManager.turnOrder
        const owed = new Map<string, number>()
        for (const { playerId, amount } of charges)
            owed.set(playerId, (owed.get(playerId) ?? 0) + amount)
        return [...owed]
            .map(([playerId, amount]) => ({ playerId, amount }))
            .sort((a, b) => order.indexOf(a.playerId) - order.indexOf(b.playerId))
    }

    /**
     * Pays the sold company's holders and resets its charter. A liquidated company's cash and the
     * proceeds first repay its loans, and its president owes any shortfall.
     */
    settleHolders(
        state: State,
        companyId: string,
        proceeds: number,
        held: HeldAside | undefined
    ): Settlement {
        const { loanRules, market } = this.rules
        const available = proceeds + (held?.cash ?? 0)
        const loans = (held?.loans ?? 0) * loanRules.value
        const debt = Math.max(0, loans - available)
        const perShare = this.perShareProceeds(state, companyId, Math.max(0, available - loans))
        const payout = shareholderPayout(state, companyId, perShare)
        settleCashPayments(state, payout.payments)
        const president = controllingOwner(state, companyId)
        const charges = this.chargesInTurnOrder(state, companyId, [
            ...payout.charges,
            ...(debt && president ? [{ playerId: president.playerId, amount: debt }] : [])
        ])
        const paid = charges.length ? chargePlayers(state, charges, 'AcquisitionRound') : []
        resetCompany(state, companyId, market.rules.charterShareCount)
        return { perShare, payments: payout.payments, charges, paid }
    }

    /** A liquidated company's cash goes to the bank while it is sold; its loans stay until settled. */
    holdAside(state: State, companyId: string): HeldAside {
        const company = { kind: 'company' as const, companyId }
        const cash = this.companyCash(state, companyId)
        if (cash) settleCashPayments(state, [{ from: company, to: { kind: 'bank' }, amount: cash }])
        return { cash, loans: companyLoans(state, companyId) }
    }

    /** The title's payment as the bank liquidates the company, settled. */
    payOnLiquidation(state: State, companyId: string): CashPayment | undefined {
        const payment = this.rules.liquidationPayment?.(state, companyId)
        if (payment) settleCashPayments(state, [payment])
        return payment
    }

    /**
     * With no buyer, a liquidated company's trains leave play, which may pay the title's train
     * departure payments, and then its privates close.
     */
    liquidateByBank(
        state: State,
        companyId: string
    ): { trainIds: string[]; payments: CashPayment[] } {
        const owner = { kind: 'company' as const, companyId }
        const trains = trainsOwnedBy(state, owner)
        const payments = settleTrainDepartures(
            state,
            this.rules.trainRules,
            trains.map((train) => ({
                trainId: train.id,
                definitionId: train.definitionId,
                cause: 'discard',
                owner
            }))
        )
        const trainIds = trains.map((train) => train.id)
        releaseTrains(state.trainInventory, trainIds, 'removed')
        const privateIds = state.certificates.flatMap((certificate) =>
            certificate.kind === 'private' && sameOwner(certificate.owner, owner)
                ? [certificate.companyId]
                : []
        )
        for (const privateId of privateIds) closePrivate(state, privateId)
        return { trainIds, payments }
    }
}
