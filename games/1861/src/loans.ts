import { ActionSource, assert } from '@tabletop/common'
import {
    CashPayment,
    LoanRecord,
    Nationalisation,
    SystemActionFirstHandler,
    automaticBorrowing,
    companyLoans,
    finiteCashOwnedBy,
    getCompany,
    hasTurnMark,
    markTurn,
    nextOperatingCompany,
    repayLoan,
    settleCashPayments,
    systemAction,
    turnInterestOwed,
    type LoanRules
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { LoanLimits1861, LoanValue1861, RsrId } from './companies.js'
import type { HydratedState1861, StateHandler1861 } from './state.js'
import { Market1861 } from './stockMarket.js'

/** Loan interest is R5 on each R50 loan (§10.2). */
const InterestRate = 10

/**
 * Loans of R50, at most two for a minor and five for a public company, and as many as the
 * RSR needs. They are taken only to pay for track, a trainless company's train from the bank,
 * or interest, and only as many as the payment needs; the first R5 of interest is paid at once
 * (§10.2).
 */
export const LoanRules1861: LoanRules = {
    market: Market1861,
    value: LoanValue1861,
    // The bank has loans for all; the RSR may borrow without limit (§10.2).
    supply: Number.POSITIVE_INFINITY,
    capacity(state, companyId) {
        if (companyId === RsrId) return Number.POSITIVE_INFINITY
        const company = getCompany(state, companyId)
        return company.kind === 'minor' ? LoanLimits1861.minor : LoanLimits1861.major
    },
    rate: () => InterestRate,
    interestDefault() {
        assert(false, 'An 1861 company that cannot pay interest is nationalised')
    },
    automatic: true,
    interestWhenTaken: true
}

export const Borrowing1861 = automaticBorrowing(LoanRules1861)

/** The turn mark of a company whose interest and repayments are settled. */
const LoansSettled = 'loans-settled'

const SettleLoansAction = systemAction('SettleLoans', {
    companyId: Type.String({ minLength: 1 }),
    metadata: Type.Optional(
        Type.Object(
            {
                interest: Type.Integer({ minimum: 0 }),
                /** Loans taken to pay the interest. */
                loans: Type.Array(LoanRecord),
                payments: Type.Array(CashPayment),
                repayments: Type.Array(CashPayment),
                /** The company could not pay its interest and was nationalised (§10.8). */
                nationalisation: Type.Optional(Nationalisation)
            },
            { additionalProperties: false }
        )
    )
})
export const SettleLoans = SettleLoansAction.schema
export type SettleLoans = Type.Static<typeof SettleLoans>
export const isSettleLoans = SettleLoansAction.is

export type LoanSettlement1861 = NonNullable<SettleLoans['metadata']>

/** What nationalising a company does; given here so loans need not know the RSR's rules. */
export type Nationalise1861 = (state: HydratedState1861, companyId: string) => Nationalisation

/**
 * Interest is due on the loans the company began its turn with, borrowing where its treasury
 * falls short. A company that still cannot pay pays nothing and is nationalised: its loans are
 * repaid from its cash and the RSR takes the rest (GTG §8.10, §10.1). Then it repays every loan
 * it can (§10.9).
 */
export function settleLoans1861(
    state: HydratedState1861,
    companyId: string,
    nationalise: Nationalise1861
): LoanSettlement1861 {
    const treasury = { kind: 'company' as const, companyId }
    const interest = turnInterestOwed(state, LoanRules1861, companyId)
    const loans =
        interest > finiteCashOwnedBy(state, treasury)
            ? Borrowing1861.borrowFor(state, companyId, interest)
            : []
    delete state.turnLoans
    markTurn(state, LoansSettled)
    if (interest > finiteCashOwnedBy(state, treasury))
        return {
            interest,
            loans,
            payments: [],
            repayments: [],
            nationalisation: nationalise(state, companyId)
        }
    const payments: CashPayment[] = interest
        ? [{ from: treasury, to: { kind: 'bank' }, amount: interest }]
        : []
    settleCashPayments(state, payments)
    const repayments: CashPayment[] = []
    while (
        companyLoans(state, companyId) &&
        finiteCashOwnedBy(state, treasury) >= LoanRules1861.value
    )
        repayments.push(repayLoan(state, LoanRules1861, companyId).payment)
    return { interest, loans, payments, repayments }
}

export function defineSettleLoans(nationalise: Nationalise1861) {
    class HydratedSettleLoans extends SettleLoansAction.Base implements SettleLoans {
        declare type: 'SettleLoans'
        declare companyId: string
        declare metadata?: SettleLoans['metadata']
        apply(state: HydratedState1861): void {
            assert(
                this.source === ActionSource.System && loansDue(state) === this.companyId,
                'Loans are settled once a turn, by the system'
            )
            this.metadata = settleLoans1861(state, this.companyId, nationalise)
        }
    }
    return SettleLoansAction.define((action) => new HydratedSettleLoans(action))
}

function loansDue(state: HydratedState1861): string | undefined {
    const companyId = nextOperatingCompany(state)
    if (!companyId || state.machineState !== 'BuyingTrains') return undefined
    return hasTurnMark(state, LoansSettled) ? undefined : companyId
}

/**
 * Loans are settled as the company comes to buy trains, after its earnings (§10); a company
 * nationalised for its interest ends its turn there.
 */
export function settlesLoans(handler: StateHandler1861): StateHandler1861 {
    return new SystemActionFirstHandler(
        handler,
        SettleLoans,
        (state) => {
            const companyId = loansDue(state)
            return companyId ? { companyId } : undefined
        },
        (state, action) => {
            assert(isSettleLoans(action), 'The loan step settles loans')
            return action.metadata?.nationalisation ? 'OperatingSet' : state.machineState
        }
    )
}
