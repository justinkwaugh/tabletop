import { ActionSource, assert, assertExists } from '@tabletop/common'
import {
    CashPayment,
    SystemActionFirstHandler,
    companyLoans,
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    nextOperatingCompany,
    settleCashPayments,
    sharesOwned,
    systemAction,
    type Debt,
    type EliminationState,
    type LoanRules,
    type LoanState
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { CgrId, MajorIds1856 } from './companies.js'
import { requireState1856, type HydratedState1856, type StateHandler1856 } from './state.js'
import { Market1856 } from './stockMarket.js'
import { NationalPhaseId, Phases1856 } from './trains.js'

/** A government loan pays $100 and costs $10 interest each operating round (Government Loans). */
export const LoanValue1856 = 100
export const InterestRate1856 = 10

/** Shares of the company held by players, its loan limit (Receiving a Government Loan). */
export function playerShares(state: LoanState, companyId: string): number {
    return state.players.reduce(
        (sum, player) =>
            sum + sharesOwned(state, companyId, { kind: 'player', playerId: player.playerId }),
        0
    )
}

/** Loans are lent until the first 6-train forms the CGR (Receiving a Government Loan). */
export function loansAvailable(state: { phaseId: string }): boolean {
    return !Phases1856.isAtLeast(state.phaseId, NationalPhaseId)
}

/**
 * The interest its treasury cannot pay in $10 steps comes off the run, down to nothing; its
 * president pays what is still owed, selling shares if they must (Pay Interest).
 */
function interestDefault(state: LoanState, companyId: string, owed: number) {
    const treasury = { kind: 'company' as const, companyId }
    const fromTreasury = Math.min(owed, Math.floor(finiteCashOwnedBy(state, treasury) / 10) * 10)
    const payments: CashPayment[] = fromTreasury
        ? [{ from: treasury, to: { kind: 'bank' }, amount: fromTreasury }]
        : []
    const run = requireState1856(state).routeStep?.result
    const revenue = run?.companyId === companyId ? run.revenue : 0
    const fromRevenue = Math.min(owed - fromTreasury, revenue)
    const president = controllingOwner(state, companyId)
    assertExists(president, 'A borrowing company has a president')
    // The president pays whole $10 units too (ST-FAQ p18).
    const fromPresident = Math.min(
        owed - fromTreasury - fromRevenue,
        Math.floor(finiteCashOwnedBy(state, president) / 10) * 10
    )
    if (fromPresident)
        payments.push({ from: president, to: { kind: 'bank' }, amount: fromPresident })
    settleCashPayments(state, payments)
    return {
        payments,
        marketMoves: [],
        unpaid: owed - fromTreasury - fromRevenue - fromPresident,
        companyDebt: true as const,
        ...(fromRevenue ? { fromRevenue } : {})
    }
}

/**
 * Loans of $100, one an operating round for each share players hold, until the 6s. Interest is
 * paid after the run, before dividends; a loan taken after it pays only $90 (Receiving a
 * Government Loan, Pay Interest).
 */
export const LoanRules1856: LoanRules = {
    market: Market1856,
    value: LoanValue1856,
    supply: Number.POSITIVE_INFINITY,
    inPlay: (state) => loansAvailable(state),
    capacity(state, companyId) {
        const company = getCompany(state, companyId)
        if (companyId === CgrId || !company.floated || !MajorIds1856.includes(companyId)) return 0
        return playerShares(state, companyId)
    },
    rate: () => InterestRate1856,
    interestDefault,
    interestBeforeEarnings: true,
    loansPerTurn: 1
}

/** Loans beyond the shares players hold, which the company must redeem at the end of its turn. */
export function excessLoans(state: HydratedState1856, companyId: string): number {
    return Math.max(0, companyLoans(state, companyId) - playerShares(state, companyId))
}

const RedeemExcessLoansAction = systemAction('RedeemExcessLoans', {
    companyId: Type.String({ minLength: 1 }),
    metadata: Type.Optional(
        Type.Object(
            {
                loans: Type.Integer({ minimum: 1 }),
                payments: Type.Array(CashPayment),
                /** What its president could not pay, to raise by selling shares. */
                unpaid: Type.Integer({ minimum: 0 })
            },
            { additionalProperties: false }
        )
    )
})
export const RedeemExcessLoans = RedeemExcessLoansAction.schema
export type RedeemExcessLoans = Type.Static<typeof RedeemExcessLoans>
export const isRedeemExcessLoans = RedeemExcessLoansAction.is

function excessDue(state: HydratedState1856): string | undefined {
    const companyId = nextOperatingCompany(state)
    if (!companyId || state.machineState !== 'RepayingLoans' || state.cashCrisis) return undefined
    return excessLoans(state, companyId) ? companyId : undefined
}

/**
 * Loans beyond the shares players hold are redeemed first in the loan step: from the treasury,
 * then by the president, selling shares if they must, never that company's (Redeem Government
 * Loans).
 */
class HydratedRedeemExcessLoans extends RedeemExcessLoansAction.Base implements RedeemExcessLoans {
    declare type: 'RedeemExcessLoans'
    declare companyId: string
    declare metadata?: RedeemExcessLoans['metadata']
    apply(state: HydratedState1856): void {
        assert(
            this.source === ActionSource.System && excessDue(state) === this.companyId,
            'Excess loans are redeemed once, by the system'
        )
        const loans = excessLoans(state, this.companyId)
        const owed = loans * LoanValue1856
        const treasury = { kind: 'company' as const, companyId: this.companyId }
        const president = controllingOwner(state, this.companyId)
        assertExists(president, 'A borrowing company has a president')
        const fromTreasury = Math.min(owed, finiteCashOwnedBy(state, treasury))
        const fromPresident = Math.min(owed - fromTreasury, finiteCashOwnedBy(state, president))
        const payments: CashPayment[] = [
            ...(fromTreasury
                ? [{ from: treasury, to: { kind: 'bank' as const }, amount: fromTreasury }]
                : []),
            ...(fromPresident
                ? [{ from: president, to: { kind: 'bank' as const }, amount: fromPresident }]
                : [])
        ]
        settleCashPayments(state, payments)
        const company = getCompany(state, this.companyId)
        const left = companyLoans(state, this.companyId) - loans
        if (left) company.loans = left
        else delete company.loans
        const unpaid = owed - fromTreasury - fromPresident
        if (unpaid)
            state.cashCrisis = {
                debts: [
                    { playerId: president.playerId, amount: unpaid, companyId: this.companyId }
                ],
                continuation: 'RepayingLoans'
            }
        this.metadata = { loans, payments, unpaid }
    }
}

export const UnredeemedLoans = Type.Object(
    {
        restoredLoans: Type.Optional(
            Type.Object(
                {
                    companyId: Type.String(),
                    loans: Type.Integer({ minimum: 1 }),
                    payments: Type.Array(CashPayment)
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type UnredeemedLoans = Type.Static<typeof UnredeemedLoans>
const UnredeemedLoansValidator = Compile(UnredeemedLoans)

/** The loans a bankruptcy left on the company it was redeeming them for, if any. */
export function bankruptcyRestoredLoans(
    changes: unknown
): UnredeemedLoans['restoredLoans'] | undefined {
    return UnredeemedLoansValidator.Check(changes) ? changes.restoredLoans : undefined
}

/**
 * A president bankrupted redeeming excess loans: each $100 the company and its president raised
 * redeemed a loan, the rest stay on it, lowering its shares' value, and what was short of a
 * further loan stays in its treasury (designer, 18xx list 49658).
 */
export function unredeemedLoans(
    state: EliminationState,
    playerId: string,
    settling?: { debt: Debt; continuation: string }
): UnredeemedLoans {
    const companyId = settling?.debt.companyId
    if (!companyId || settling.continuation !== 'RepayingLoans') return {}
    const player: CashPayment['from'] = { kind: 'player', playerId }
    const cash = finiteCashOwnedBy(state, player)
    const short = settling.debt.amount - cash
    const loans = Math.ceil(short / LoanValue1856)
    const treasury: CashPayment['to'] = { kind: 'company', companyId }
    const refund = loans * LoanValue1856 - settling.debt.amount
    const payments: CashPayment[] = [
        ...(cash ? [{ from: player, to: treasury, amount: cash }] : []),
        ...(refund > 0 ? [{ from: { kind: 'bank' as const }, to: treasury, amount: refund }] : []),
        ...(refund < 0 ? [{ from: treasury, to: { kind: 'bank' as const }, amount: -refund }] : [])
    ]
    settleCashPayments(state, payments)
    const company = getCompany(state, companyId)
    company.loans = companyLoans(state, companyId) + loans
    return { restoredLoans: { companyId, loans, payments } }
}

export const LoanActions1856 = [
    RedeemExcessLoansAction.define((action) => new HydratedRedeemExcessLoans(action))
]

export function redeemsExcessLoans(handler: StateHandler1856): StateHandler1856 {
    return new SystemActionFirstHandler(
        handler,
        RedeemExcessLoans,
        (state) => {
            const companyId = excessDue(state)
            return companyId ? { companyId } : undefined
        },
        (state) => (state.cashCrisis ? 'RaisingCash' : state.machineState)
    )
}
