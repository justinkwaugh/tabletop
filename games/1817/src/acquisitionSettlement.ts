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
    finiteCashOwnedBy,
    getCompany,
    moveCompanyMarker,
    moveCompanyStations,
    resetCompany,
    sameOwner,
    settleCashPayments,
    shareholderPayout,
    takeLoan,
    transferCompanyAssets,
    turnOrderFrom,
    unownedTrain,
    type EighteenXXState
} from '@tabletop/18xx'
import { perShareProceeds, treasuryCompensation } from './acquisitionRules.js'
import { EighteenSeventeenLoanRules } from './loanRules.js'
import { CharterShareCount, trimStations } from './mergerRules.js'
import type { Acquisition, CompanySale, HeldAside } from './state.js'

const Loans = EighteenSeventeenLoanRules

export const AcquisitionRecord = Type.Object(
    {
        price: Type.Integer({ minimum: 1 }),
        treasuryPayment: Type.Optional(CashPayment),
        loans: Type.Array(LoanRecord),
        assets: AssetTransfer,
        stations: StationTransfer,
        payment: CashPayment
    },
    { additionalProperties: false }
)
export type AcquisitionRecord = Type.Static<typeof AcquisitionRecord>

function companyCash(state: EighteenXXState, companyId: string): number {
    return finiteCashOwnedBy(state, { kind: 'company', companyId })
}

/**
 * The buyer takes the sold company's assets and pays the bank, borrowing first for what it
 * lacks, before it takes on the sold company's loans.
 */
export function acquireCompany(
    state: EighteenXXState,
    sale: CompanySale,
    buyerId: string,
    price: number
): AcquisitionRecord {
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
    const assets = transferCompanyAssets(state, sale.companyId, buyerId)
    const stations = moveCompanyStations(state, sale.companyId, buyerId)
    trimStations(state, buyerId)
    const payment = {
        from: { kind: 'company' as const, companyId: buyerId },
        to: { kind: 'bank' as const },
        amount: price
    }
    settleCashPayments(state, [payment])
    return {
        price,
        ...(treasuryPayment ? { treasuryPayment } : {}),
        loans,
        assets,
        stations,
        payment
    }
}

export function canRepayAcquiredLoan(state: EighteenXXState, acquisition: Acquisition): boolean {
    return (
        acquisition.repaidLoans < acquisition.inheritedLoans &&
        companyCash(state, acquisition.buyerId) >= Loans.value
    )
}

/** Repays one of the buyer's loans without moving its price. */
export function repayWithoutMove(state: EighteenXXState, companyId: string): CashPayment {
    const payment = {
        from: { kind: 'company' as const, companyId },
        to: { kind: 'bank' as const },
        amount: Loans.value
    }
    settleCashPayments(state, [payment])
    const company = getCompany(state, companyId)
    if (company.loans === 1) delete company.loans
    else company.loans = companyLoans(state, companyId) - 1
    return payment
}

export const BuyerLoansRecord = Type.Object(
    { repayments: Type.Array(CashPayment), marketMoves: Type.Array(StockMarketMove) },
    { additionalProperties: false }
)
export type BuyerLoansRecord = Type.Static<typeof BuyerLoansRecord>

/**
 * Loans over the buyer's limit are repaid from its cash, then each inherited loan it still
 * holds moves its price left.
 */
export function settleBuyerLoans(
    state: EighteenXXState,
    acquisition: Acquisition
): BuyerLoansRecord {
    const { buyerId } = acquisition
    const repayments: CashPayment[] = []
    while (
        companyLoans(state, buyerId) > Loans.capacity(state, buyerId) &&
        companyCash(state, buyerId) >= Loans.value
    )
        repayments.push(repayWithoutMove(state, buyerId))
    const unpaid = Math.max(
        0,
        acquisition.inheritedLoans - acquisition.repaidLoans - repayments.length
    )
    const marketMoves: StockMarketMove[] = []
    for (let loan = 0; loan < unpaid; loan++) {
        const move = moveCompanyMarker(state.stockMarket, buyerId, 'left', 1)
        if (move) marketMoves.push(move)
    }
    return { repayments, marketMoves }
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
    state: EighteenXXState,
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
    state: EighteenXXState,
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
    resetCompany(state, companyId, { shareCount: CharterShareCount })
    return { perShare, payments: payout.payments, charges, paid }
}

/** Sets a liquidated company's cash and loans aside while it is sold. */
export function holdAside(state: EighteenXXState, companyId: string): HeldAside {
    const company = { kind: 'company' as const, companyId }
    const cash = companyCash(state, companyId)
    if (cash) settleCashPayments(state, [{ from: company, to: { kind: 'bank' }, amount: cash }])
    const loans = companyLoans(state, companyId)
    delete getCompany(state, companyId).loans
    return { cash, loans }
}

/** With no buyer, a liquidated company's trains leave play and its privates close. */
export function liquidateByBank(state: EighteenXXState, companyId: string): string[] {
    const owner = { kind: 'company' as const, companyId }
    const trainIds: string[] = []
    state.trainInventory.trains = state.trainInventory.trains.map((train) => {
        if (train.status !== 'owned' || !sameOwner(train.owner, owner)) return train
        trainIds.push(train.id)
        return unownedTrain(train, 'removed')
    })
    const privateIds = state.certificates.flatMap((certificate) =>
        !certificate.retired &&
        certificate.kind === 'private' &&
        sameOwner(certificate.owner, owner)
            ? [certificate.companyId]
            : []
    )
    for (const privateId of privateIds) closePrivate(state, privateId)
    return trainIds
}
