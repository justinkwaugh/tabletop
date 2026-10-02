import { assert, assertExists } from '@tabletop/common'
import {
    RepayLoan,
    TakeLoan,
    companyLoans,
    interestOwed,
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
    operatingCompanyId = $derived.by(() =>
        this.rules && this.session.state.machineState !== 'StockRound'
            ? nextOperatingCompany(this.session.state)
            : undefined
    )
    canTake = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('TakeLoan')
    )
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
    /** What the company owes at the fixed rate, while one is fixed. */
    interest(companyId: string): number | undefined {
        const rules = this.rules
        return rules && this.session.state.interestRate !== undefined
            ? interestOwed(this.session.state, rules, companyId)
            : undefined
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
