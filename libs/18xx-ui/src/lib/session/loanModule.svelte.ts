import { assert, assertExists } from '@tabletop/common'
import {
    RepayLoan,
    TakeLoan,
    companyLoans,
    isPayInterest,
    loansRemaining,
    nextOperatingCompany,
    type EighteenXXState,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'

export type LoanSession = ModuleSession<EighteenXXState, Pick<EighteenXXTitleRules, 'loanRules'>>

export class LoanModule {
    constructor(private readonly session: LoanSession) {}

    rules = $derived.by(() => this.session.rules.loanRules)
    /** The rate fixed for the operating round, or the rate the next round would fix. */
    rate = $derived.by(() => {
        const rules = this.rules
        return rules
            ? (this.session.state.interestRate ?? rules.rate(this.session.state))
            : undefined
    })
    /** The rate the next operating round would fix, from the loans now outstanding. */
    nextRate = $derived.by(() => this.rules?.rate(this.session.state))
    /** Loans the bank can still lend. */
    remaining = $derived.by(() =>
        this.rules ? loansRemaining(this.session.state, this.rules) : undefined
    )
    operatingCompanyId = $derived.by(() =>
        this.rules && this.session.state.machineState !== 'StockRound'
            ? nextOperatingCompany(this.session.state)
            : undefined
    )
    canTake = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('TakeLoan')
    )
    /** The interest the operating company has paid this turn, once it has. */
    interestPaid = $derived.by(() => {
        const companyId = this.operatingCompanyId
        const actions = this.session.recordedActions
        const turnStart = actions.findLastIndex((action) => action.type === 'StartOperatingTurn')
        const payment = actions
            .slice(turnStart + 1)
            .find((action) => isPayInterest(action) && action.companyId === companyId)
        return payment && isPayInterest(payment) ? payment.metadata : undefined
    })
    canRepay = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('RepayLoan')
    )

    loans(companyId: string): number {
        return companyLoans(this.session.state, companyId)
    }
    capacity(companyId: string): number {
        assertExists(this.rules, 'This title has no loans')
        return this.rules.capacity(this.session.state, companyId)
    }

    async take(companyId: string) {
        assert(this.canTake, 'The company cannot borrow now')
        await this.session.applyAction(this.session.createPlayerAction(TakeLoan, { companyId }))
    }
    async repay(companyId: string) {
        assert(this.canRepay, 'The company cannot repay a loan now')
        await this.session.applyAction(this.session.createPlayerAction(RepayLoan, { companyId }))
    }
}
