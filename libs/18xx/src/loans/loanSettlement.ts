import { ActionSource, assert } from '@tabletop/common'
import * as Type from 'typebox'
import type { ActionDefinition } from '../actions/actionDefinition.js'
import { systemAction } from '../actions/titleAction.js'
import { Nationalisation } from '../company/nationalisation.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { finiteCashOwnedBy } from '../finance/finance.js'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import { SystemActionFirstHandler } from '../game/systemActionFirstHandler.js'
import { hasTurnMark, markTurn } from '../operating/finishOperatingTurn.js'
import { nextOperatingCompany } from '../operating/operatingSet.js'
import { automaticBorrowing } from './automaticBorrowing.js'
import { LoanRecord, companyLoans, repayLoan, turnInterestOwed, type LoanRules } from './loans.js'

type State = HydratedEighteenXXState

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
                /** The company could not pay its interest and was nationalised. */
                nationalisation: Type.Optional(Nationalisation)
            },
            { additionalProperties: false }
        )
    )
})
export const SettleLoans = SettleLoansAction.schema
export type SettleLoans = Type.Static<typeof SettleLoans>
export const isSettleLoans = SettleLoansAction.is

export type LoanSettlement = NonNullable<SettleLoans['metadata']>

/**
 * The loan step of a title whose companies borrow only as payments need: interest is due on the
 * loans the company began its turn with, borrowing where its treasury falls short; a company that
 * still cannot pay pays nothing and is nationalised, its loans repaid from its cash. Then it
 * repays every loan it can (1861 §10.8–§10.9, 1867 GTG §8.10).
 */
export class LoanSettlements {
    constructor(
        readonly loans: LoanRules,
        readonly nationalise: (state: State, companyId: string) => Nationalisation
    ) {}

    settle(state: State, companyId: string): LoanSettlement {
        const treasury = { kind: 'company' as const, companyId }
        const interest = turnInterestOwed(state, this.loans, companyId)
        const loans =
            interest > finiteCashOwnedBy(state, treasury)
                ? automaticBorrowing(this.loans).borrowFor(state, companyId, interest)
                : []
        delete state.turnLoans
        markTurn(state, LoansSettled)
        if (interest > finiteCashOwnedBy(state, treasury))
            return {
                interest,
                loans,
                payments: [],
                repayments: [],
                nationalisation: this.nationalise(state, companyId)
            }
        const payments: CashPayment[] = interest
            ? [{ from: treasury, to: { kind: 'bank' }, amount: interest }]
            : []
        settleCashPayments(state, payments)
        const repayments: CashPayment[] = []
        while (
            companyLoans(state, companyId) &&
            finiteCashOwnedBy(state, treasury) >= this.loans.value
        )
            repayments.push(repayLoan(state, this.loans, companyId).payment)
        return { interest, loans, payments, repayments }
    }

    /** The company whose loans are due: the one operating, as it comes to buy trains. */
    due(state: State): string | undefined {
        const companyId = nextOperatingCompany(state)
        if (!companyId || state.machineState !== 'BuyingTrains') return undefined
        return hasTurnMark(state, LoansSettled) ? undefined : companyId
    }

    actions(): ActionDefinition[] {
        return LoanSettlements.actionsOf(this)
    }

    private static actionsOf(settlements: LoanSettlements): ActionDefinition[] {
        class HydratedSettleLoans extends SettleLoansAction.Base implements SettleLoans {
            declare type: 'SettleLoans'
            declare companyId: string
            declare metadata?: SettleLoans['metadata']
            apply(state: State): void {
                assert(
                    this.source === ActionSource.System &&
                        settlements.due(state) === this.companyId,
                    'Loans are settled once a turn, by the system'
                )
                this.metadata = settlements.settle(state, this.companyId)
            }
        }
        return [SettleLoansAction.define((action) => new HydratedSettleLoans(action))]
    }

    /**
     * Loans are settled as the company comes to buy trains, after its earnings; a company
     * nationalised for its interest ends its turn there.
     */
    settles<S extends State>(handler: EighteenXXStateHandler<S>): EighteenXXStateHandler<S> {
        return new SystemActionFirstHandler(
            handler,
            SettleLoans,
            (state) => {
                const companyId = this.due(state)
                return companyId ? { companyId } : undefined
            },
            (state, action) => {
                assert(isSettleLoans(action), 'The loan step settles loans')
                return action.metadata?.nationalisation ? 'OperatingSet' : state.machineState
            }
        )
    }
}
