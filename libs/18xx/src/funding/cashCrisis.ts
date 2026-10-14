import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy, sharesOwned, type Owner } from '../finance/finance.js'
import { StockMarketMove } from '../stock/stockMarket.js'
import { evaluateShareDisposal, type ShareSale, type ShareSaleResult } from '../stock/shareSale.js'
import type { ShareSaleTerms, StockRules } from '../stock/stockRules.js'
import type { StockState } from '../stock/stockState.js'
import type { OperatingState } from '../operating/operatingSet.js'
import type { LoanState } from '../loans/loans.js'

const Id = Type.String({ minLength: 1 })
export const Debt = Type.Object(
    { playerId: Id, amount: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export type Debt = Type.Static<typeof Debt>
/** Players who owe the bank more than they have, settled in order, and where play resumes. */
export const CashCrisis = Type.Object(
    { debts: Type.Array(Debt, { minItems: 1 }), continuation: Id },
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

export const BankruptcyRecord = Type.Object(
    {
        liquidatedCompanyIds: Type.Array(Id),
        marketMoves: Type.Array(StockMarketMove)
    },
    { additionalProperties: false }
)
export type BankruptcyRecord = Type.Static<typeof BankruptcyRecord>

/** A sale to raise cash is refused if it would pass a presidency to another player. */
export interface CashCrisisRules extends Pick<
    StockRules,
    'market' | 'presidencyCandidates' | 'afterSale'
> {
    saleTerms(
        state: StockState,
        companyId: string,
        shares: number,
        seller: Owner
    ): ShareSaleTerms | string
    /**
     * Disposes of a bankrupt player's shares and companies; the family then takes their cash,
     * forgives the debt and removes them from play.
     */
    bankrupt(state: CashCrisisState, playerId: string): BankruptcyRecord
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
    if (settlement.presidency) return { reason: 'This sale would pass on a presidency.' }
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
