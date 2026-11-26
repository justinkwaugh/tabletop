import { assert, assertExists } from '@tabletop/common'
import {
    RepayLoan,
    TakeLoan,
    companyLoans,
    isPayInterest,
    loanRate,
    loanRateTable,
    loansOutstanding,
    nextOperatingCompany,
    turnInterestOwed,
    type EighteenXXState,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'
import { loanRateTableView } from '../loans/loanRateTable.js'

export type LoanSession = ModuleSession<EighteenXXState, Pick<EighteenXXTitleRules, 'loanRules'>>

export class LoanModule {
    constructor(
        private readonly session: LoanSession,
        private readonly operatingRoundInProgress: () => boolean
    ) {}

    /** The title's loans, where they are in this game. */
    rules = $derived.by(() => {
        const rules = this.session.rules.loanRules
        return rules && (rules.inPlay?.(this.session.state) ?? true) ? rules : undefined
    })
    /** The rate fixed for the operating round, or the rate the next round would fix. */
    rate = $derived.by(() => {
        const rules = this.rules
        return rules
            ? (this.session.state.interestRate ?? loanRate(this.session.state, rules))
            : undefined
    })
    /** The rate the next operating round would fix, from the loans now outstanding. */
    nextRate = $derived.by(() =>
        this.rules ? loanRate(this.session.state, this.rules) : undefined
    )
    /** The title's printed rate table, where its rate rises with the loans outstanding. */
    rateTable = $derived.by(() => {
        const state = this.session.state
        const table = this.rules && loanRateTable(state, this.rules)
        if (!table) return undefined
        const roundRate = this.operatingRoundInProgress() ? state.interestRate : undefined
        return loanRateTableView(table, loansOutstanding(state), roundRate)
    })
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
    /** The interest the operating company will owe this turn on its loans now, until it pays. */
    interestDue = $derived.by(() => {
        const rules = this.rules
        const companyId = this.operatingCompanyId
        if (!rules || rules.automatic || !companyId || this.interestPaid) return undefined
        return turnInterestOwed(this.session.state, rules, companyId) || undefined
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
    /** The company's loans against its limit, or alone where it may borrow without one. */
    held(companyId: string): string {
        const capacity = this.capacity(companyId)
        const loans = this.loans(companyId)
        return Number.isFinite(capacity) ? `${loans}/${capacity}` : String(loans)
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
