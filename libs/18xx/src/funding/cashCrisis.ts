import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy, sharesOwned, type Owner } from '../finance/finance.js'
import { evaluateShareDisposal, type ShareSale, type ShareSaleResult } from '../stock/shareSale.js'
import type { ShareSaleTerms, StockRules } from '../stock/stockRules.js'
import type { StockState } from '../stock/stockState.js'
import type { OperatingState } from '../operating/operatingSet.js'
import type { LoanState } from '../loans/loans.js'
import type { EliminationRules } from './elimination.js'
import type { FundingState, InsolvencyRules } from './trainFunding.js'

const Id = Type.String({ minLength: 1 })
export const Debt = Type.Object(
    {
        playerId: Id,
        amount: Type.Integer({ minimum: 1 }),
        /**
         * The company whose debt its president raises, as 1849's bond money is (§14.2): the
         * company's presidency stays with them, and the title's insolvency settles what they cannot.
         */
        companyId: Type.Optional(Id)
    },
    { additionalProperties: false }
)
export type Debt = Type.Static<typeof Debt>
/**
 * Players who owe the bank more than they have, settled in order, and where play resumes. Its
 * debts are all settled only while companies its sales closed are closing, which may add more.
 */
export const CashCrisis = Type.Object(
    { debts: Type.Array(Debt), continuation: Id },
    { additionalProperties: false }
)
export type CashCrisis = Type.Static<typeof CashCrisis>
export const CashCrisisFields = {
    cashCrisis: Type.Optional(CashCrisis),
    bankruptPlayerIds: Type.Optional(Type.Array(Id, { minItems: 1, uniqueItems: true }))
}
export type CashCrisisState = OperatingState &
    LoanState &
    Type.Static<Type.TObject<typeof CashCrisisFields>>

/**
 * A sale to raise cash is refused if it would pass a presidency the title protects. A player who
 * cannot pay leaves the game, or, for a company's debt where the title has insolvency rules, the
 * company fails while its president plays on.
 */
export interface CashCrisisRules extends Pick<
    StockRules,
    | 'market'
    | 'charters'
    | 'presidencyCandidates'
    | 'presidencyExchange'
    | 'afterSale'
    | 'holdsMarketMove'
> {
    saleTerms(
        state: StockState,
        companyId: string,
        shares: number,
        seller: Owner
    ): ShareSaleTerms | string
    /**
     * Whether a sale may not pass the presidency of the company sold; every presidency unless
     * given, as 1849 keeps only that of the company whose debt it is (§10.7).
     */
    protectsPresidency?(companyId: string, debt: Debt): boolean
    /**
     * How a player who cannot pay leaves the game; the family forgives their debt. A title whose
     * every debt is a company's, settled by insolvency, has none.
     */
    elimination?: EliminationRules
    /**
     * How a company whose debt its president cannot pay fails, as 1849's corporation closes
     * (§10.7); only once every sale is made, and in place of elimination.
     */
    insolvency?: InsolvencyRules
}

/** The insolvency that settles the debt, if the title's rules fail its company for it. */
export function debtInsolvency(rules: CashCrisisRules, debt: Debt): InsolvencyRules | undefined {
    return debt.companyId ? rules.insolvency : undefined
}

/** The choices the president of a failing company makes, once no sale can pay its debt. */
export function crisisInsolvencyChoices(
    state: CashCrisisState & FundingState,
    rules: CashCrisisRules,
    debt: Debt
): readonly string[] {
    const insolvency = debtInsolvency(rules, debt)
    if (!insolvency || !debt.companyId) return []
    return insolvency.choices(state, {
        companyId: debt.companyId,
        playerId: debt.playerId,
        shortfall: debt.amount
    })
}

export function isBankrupt(state: StockState, playerId: string): boolean {
    return !!state.bankruptPlayerIds?.includes(playerId)
}

export function solventPlayerCount(state: StockState): number {
    return state.players.length - (state.bankruptPlayerIds?.length ?? 0)
}

/** Players in turn order, followed by those who have gone bankrupt and left it. */
export function playersWithBankruptLast(state: StockState): string[] {
    return [...state.turnManager.turnOrder, ...(state.bankruptPlayerIds ?? [])]
}

export function currentDebt(state: Pick<CashCrisisState, 'cashCrisis'>): Debt | undefined {
    return state.cashCrisis?.debts[0]
}

/**
 * Charges each player what they owe the bank: they pay what they have, and any shortfall
 * becomes a cash crisis, after which play resumes at `continuation`.
 */
export function chargePlayers(
    state: CashCrisisState,
    charges: readonly Debt[],
    continuation: string
): CashPayment[] {
    assert(!state.cashCrisis, 'Another cash crisis is unresolved')
    const payments: CashPayment[] = []
    const debts: Debt[] = []
    for (const { playerId, amount } of charges) {
        const player = { kind: 'player' as const, playerId }
        const paid = Math.min(amount, finiteCashOwnedBy(state, player))
        if (paid) payments.push({ from: player, to: { kind: 'bank' }, amount: paid })
        if (amount > paid) debts.push({ playerId, amount: amount - paid })
    }
    settleCashPayments(state, payments)
    if (debts.length) state.cashCrisis = { debts, continuation }
    return payments
}

/**
 * Holds a settled crisis open while closures its sales caused come first, so that play then
 * resumes where it was going.
 */
export function holdSettledCrisis(state: CashCrisisState, continuation: string): void {
    state.cashCrisis ??= { debts: [], continuation }
}

/** Where a crisis goes once its closures are done: on raising cash, or where play resumes. */
export function resumeCashCrisis(state: CashCrisisState): string {
    const crisis = state.cashCrisis
    assertExists(crisis, 'A cash crisis resumes once its closures are done')
    if (crisis.debts.length) return 'RaisingCash'
    delete state.cashCrisis
    return crisis.continuation
}

/** Removes the settled current debt, returning where play resumes once none remains. */
export function settleCurrentDebt(state: CashCrisisState): string | undefined {
    const crisis = state.cashCrisis
    assertExists(crisis, 'A debt is settled during a cash crisis')
    crisis.debts.shift()
    if (crisis.debts.length) return undefined
    delete state.cashCrisis
    return crisis.continuation
}

export function evaluateCrisisSale(
    state: CashCrisisState,
    rules: CashCrisisRules,
    playerId: string,
    sale: ShareSale
): ShareSaleResult {
    const debt = currentDebt(state)
    if (debt?.playerId !== playerId) return { reason: 'This player has no debt to raise.' }
    const seller = { kind: 'player' as const, playerId }
    const result = evaluateShareDisposal(state, seller, [sale], rules)
    if (!result.details) return result
    const [settlement] = result.details.sales
    if (settlement.presidency && (rules.protectsPresidency?.(sale.companyId, debt) ?? true))
        return { reason: 'This sale would pass on a presidency.' }
    if ((sale.shares - 1) * settlement.price >= debt.amount)
        return { reason: 'Sell only as many shares as the debt needs.' }
    return result
}

/** Every sale the player could make now to raise cash, one per company and share count. */
export function crisisSales(
    state: CashCrisisState,
    rules: CashCrisisRules,
    playerId: string
): { sale: ShareSale; proceeds: number }[] {
    const seller = { kind: 'player' as const, playerId }
    return state.companies.flatMap((company) => {
        const owned = company.kind === 'private' ? 0 : sharesOwned(state, company.id, seller)
        return Array.from({ length: owned }, (_, index) => {
            const sale = { companyId: company.id, shares: index + 1 }
            const result = evaluateCrisisSale(state, rules, playerId, sale)
            return result.details ? [{ sale, proceeds: result.details.proceeds }] : []
        }).flat()
    })
}

export function validateCashCrisis(state: {
    machineState: string
    cashCrisis?: CashCrisis
    bankruptPlayerIds?: readonly string[]
    players: readonly { playerId: string }[]
}): void {
    assert(
        !state.cashCrisis === (state.machineState !== 'RaisingCash'),
        'A cash crisis belongs to its own state'
    )
    for (const playerId of [
        ...(state.cashCrisis?.debts.map((debt) => debt.playerId) ?? []),
        ...(state.bankruptPlayerIds ?? [])
    ])
        assert(
            state.players.some((player) => player.playerId === playerId),
            'Unknown player in debt'
        )
}
