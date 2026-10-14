import { EighteenSeventeenMarket } from './stockMarket.js'
import type { EighteenSeventeenState } from './state.js'
import * as Type from 'typebox'
import {
    AssetTransfer,
    CashPayment,
    Debt,
    LoanRecord,
    StationTransfer,
    StockMarketMove,
    chargePlayers,
    closePrivate,
    companyLoans,
    controllingOwner,
    moveCompanyStations,
    repayLoan,
    resetCompany,
    sameOwner,
    settleTrainDepartures,
    settleCashPayments,
    shareholderPayout,
    takeLoan,
    transferCompanyAssets,
    turnOrderFrom,
    trainsOwnedBy,
    releaseTrains
} from '@tabletop/18xx'
import { EighteenSeventeenTrainRules } from './trains.js'
import {
    companyCash,
    inheritedLoans,
    perShareProceeds,
    treasuryCompensation
} from './acquisitionRules.js'
import { EighteenSeventeenLoanRules } from './loanRules.js'
import { CharterShareCount, trimStations } from './mergerRules.js'
import type { Acquisition, HeldAside, SaleTerms } from './state.js'
import { GoldenParachuteId, companyHolding } from './privateHolders.js'

const Loans = EighteenSeventeenLoanRules
// Repaying the loans an acquisition brings moves no price.
const { repayMove: _repayMove, ...RepaymentInPlace } = Loans

const GoldenParachuteValue = 100

function payGoldenParachute(state: EighteenSeventeenState, playerId: string): CashPayment {
    const payment = {
        from: { kind: 'bank' as const },
        to: { kind: 'player' as const, playerId },
        amount: GoldenParachuteValue
    }
    settleCashPayments(state, [payment])
    return payment
}

/** The Golden Parachute pays its company's president when another president's company buys it. */
export function parachuteOnAcquisition(
    state: EighteenSeventeenState,
    companyId: string,
    buyerId: string
): CashPayment | undefined {
    if (companyHolding(state, GoldenParachuteId) !== companyId) return undefined
    const president = controllingOwner(state, companyId)
    if (!president || controllingOwner(state, buyerId)?.playerId === president.playerId)
        return undefined
    return payGoldenParachute(state, president.playerId)
}

/** It also pays when the bank liquidates its company, if the company still has a president. */
export function parachuteOnLiquidation(
    state: EighteenSeventeenState,
    companyId: string
): CashPayment | undefined {
    if (companyHolding(state, GoldenParachuteId) !== companyId) return undefined
    const president = controllingOwner(state, companyId)
    return president ? payGoldenParachute(state, president.playerId) : undefined
}

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

/**
 * The buyer takes the sold company's assets and pays the bank, borrowing first for what it
 * lacks, before it takes on the sold company's loans. Those over its limit are repaid at once,
 * before it chooses to repay any others.
 */
export function acquireCompany(
    state: EighteenSeventeenState,
    sale: SaleTerms,
    buyerId: string,
    price: number
): AcquisitionRecord {
    const parachute = parachuteOnAcquisition(state, sale.companyId, buyerId)
    const compensation = treasuryCompensation(state, sale.companyId, sale.kind)
    const treasuryPayment = compensation
        ? {
              from: { kind: 'bank' as const },
              to: { kind: 'company' as const, companyId: sale.companyId },
              amount: compensation
          }
        : undefined
    if (treasuryPayment) settleCashPayments(state, [treasuryPayment])
    const loans: LoanRecord[] = []
    while (companyCash(state, buyerId) + companyCash(state, sale.companyId) < price)
        loans.push(takeLoan(state, Loans, buyerId))
    const assets = transferCompanyAssets(state, sale.companyId, buyerId, {
        loans: inheritedLoans(state, sale) > 0
    })
    const stations = moveCompanyStations(state, sale.companyId, buyerId)
    trimStations(state, buyerId)
    const payment = {
        from: { kind: 'company' as const, companyId: buyerId },
        to: { kind: 'bank' as const },
        amount: price
    }
    settleCashPayments(state, [payment])
    const repayments: CashPayment[] = []
    while (
        companyLoans(state, buyerId) > Loans.capacity(state, buyerId) &&
        companyCash(state, buyerId) >= Loans.value
    )
        repayments.push(repayAcquiredLoan(state, buyerId).payment)
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

export function canRepayAcquiredLoan(
    state: EighteenSeventeenState,
    acquisition: Acquisition
): boolean {
    return (
        acquisition.repaidLoans < acquisition.inheritedLoans &&
        companyCash(state, acquisition.buyerId) >= Loans.value
    )
}

export function repayAcquiredLoan(state: EighteenSeventeenState, buyerId: string): LoanRecord {
    return repayLoan(state, RepaymentInPlace, buyerId)
}

/** Each inherited loan the buyer still holds moves its price left. */
export function moveBuyerForUnpaidLoans(
    state: EighteenSeventeenState,
    acquisition: Acquisition
): StockMarketMove[] {
    const marketMoves: StockMarketMove[] = []
    for (let loan = acquisition.repaidLoans; loan < acquisition.inheritedLoans; loan++) {
        const move = EighteenSeventeenMarket.moveCompanyMarker(
            state.stockMarket,
            acquisition.buyerId,
            'left',
            1
        )
        if (move) marketMoves.push(move)
    }
    return marketMoves
}

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

// Charges are met in turn order from the sold company's president.
function chargesInTurnOrder(
    state: EighteenSeventeenState,
    companyId: string,
    charges: readonly Debt[]
): Debt[] {
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
export function settleHolders(
    state: EighteenSeventeenState,
    companyId: string,
    proceeds: number,
    held: HeldAside | undefined
): Settlement {
    const available = proceeds + (held?.cash ?? 0)
    const loans = (held?.loans ?? 0) * Loans.value
    const debt = Math.max(0, loans - available)
    const perShare = perShareProceeds(state, companyId, Math.max(0, available - loans))
    const payout = shareholderPayout(state, companyId, perShare)
    settleCashPayments(state, payout.payments)
    const president = controllingOwner(state, companyId)
    const charges = chargesInTurnOrder(state, companyId, [
        ...payout.charges,
        ...(debt && president ? [{ playerId: president.playerId, amount: debt }] : [])
    ])
    const paid = charges.length ? chargePlayers(state, charges, 'AcquisitionRound') : []
    resetCompany(state, companyId, CharterShareCount)
    return { perShare, payments: payout.payments, charges, paid }
}

/** A liquidated company's cash goes to the bank while it is sold; its loans stay until settled. */
export function holdAside(state: EighteenSeventeenState, companyId: string): HeldAside {
    const company = { kind: 'company' as const, companyId }
    const cash = companyCash(state, companyId)
    if (cash) settleCashPayments(state, [{ from: company, to: { kind: 'bank' }, amount: cash }])
    return { cash, loans: companyLoans(state, companyId) }
}

/**
 * With no buyer, a liquidated company's trains leave play, which may pay its Inventor, and then
 * its privates close.
 */
export function liquidateByBank(
    state: EighteenSeventeenState,
    companyId: string
): { trainIds: string[]; payments: CashPayment[] } {
    const owner = { kind: 'company' as const, companyId }
    const trains = trainsOwnedBy(state, owner)
    const payments = settleTrainDepartures(
        state,
        EighteenSeventeenTrainRules,
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
