import { assert } from '@tabletop/common'
import {
    CorporateFinance,
    corporateFinanceCertificates,
    corporateFinanceChoices,
    finiteCashOwnedBy,
    type EighteenXXTitleRules,
    type FinanceChoice
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'

export type CorporateFinanceSession = ModuleSession<
    Parameters<typeof corporateFinanceChoices>[0],
    Pick<EighteenXXTitleRules, 'corporateFinanceRules'>
>
export type CorporateFinanceHoldings = {
    companyId: string
    cash: number
    treasuryShares: number
    marketShares: number
}

/** Issuing and redeeming the operating corporation's treasury shares, for titles with corporate finance rules. */
export class CorporateFinanceModule {
    constructor(private readonly session: CorporateFinanceSession) {}

    choices = $derived.by((): readonly FinanceChoice[] => {
        const rules = this.session.rules.corporateFinanceRules
        return rules ? corporateFinanceChoices(this.session.state, rules) : []
    })
    label = $derived.by(() => {
        const operations = new Set(this.choices.map((choice) => choice.operation))
        if (operations.size > 1) return 'Issue / redeem'
        return operations.has('issue') ? 'Issue shares' : 'Redeem shares'
    })
    prompt = $derived(this.label === 'Issue / redeem' ? 'Issue or redeem shares' : this.label)
    holdings = $derived.by((): CorporateFinanceHoldings | undefined => {
        const rules = this.session.rules.corporateFinanceRules
        const companyId = this.choices[0]?.companyId
        if (!rules || !companyId) return undefined
        const { state } = this.session
        const shares = (operation: FinanceChoice['operation']) =>
            corporateFinanceCertificates(state, companyId, operation, rules.marketPoolId).length
        return {
            companyId,
            cash: finiteCashOwnedBy(state, { kind: 'company', companyId }),
            treasuryShares: shares('issue'),
            marketShares: shares('redeem')
        }
    })
    canApply = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('CorporateFinance')
    )

    async apply(choice: FinanceChoice) {
        assert(this.canApply, 'The company cannot issue or redeem shares now')
        await this.session.applyAction(this.session.createPlayerAction(CorporateFinance, choice))
    }
}
