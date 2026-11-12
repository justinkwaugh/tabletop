import { assert } from '@tabletop/common'
import {
    CorporateFinance,
    certificatesInPool,
    corporateFinanceChoices,
    finiteCashOwnedBy,
    type EighteenXXTitleRules,
    type FinanceChoice
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'
import type { ModeLabel } from './operatingModeModule.svelte.js'

export type CorporateFinanceSession = ModuleSession<
    Parameters<typeof corporateFinanceChoices>[0],
    Pick<EighteenXXTitleRules, 'corporateFinanceRules'>
>
export type CorporateFinanceHoldings = {
    companyId: string
    cash: number
    treasuryShares: number
    marketShares: number
    issuePoolShares?: number
}
export type CorporateFinanceTerms = {
    issue: string
    issueNote?: string
    /** Shown when its holding decides whether the company may issue, as 1894's IPO does. */
    issuePool?: { label: string; poolId: string }
}

/** Issuing and redeeming the operating corporation's treasury shares, for titles with corporate finance rules. */
export class CorporateFinanceModule {
    constructor(
        private readonly session: CorporateFinanceSession,
        private readonly titleTerms: () => CorporateFinanceTerms | undefined = () => undefined
    ) {}

    terms = $derived.by((): CorporateFinanceTerms => this.titleTerms() ?? { issue: 'Issue' })

    choices = $derived.by((): readonly FinanceChoice[] => {
        const rules = this.session.rules.corporateFinanceRules
        return rules ? corporateFinanceChoices(this.session.state, rules) : []
    })
    private operations = $derived.by(() => new Set(this.choices.map((choice) => choice.operation)))
    /** The switch's labels; each short one is part of its long one, so it still names it. */
    modeLabel = $derived.by((): ModeLabel => {
        const { issue } = this.terms
        if (this.operations.size > 1)
            return { label: `${issue} / redeem`, shortLabel: `${issue} / redeem` }
        return this.operations.has('issue')
            ? { label: `${issue} shares`, shortLabel: issue }
            : { label: 'Redeem shares', shortLabel: 'Redeem' }
    })
    prompt = $derived(
        this.operations.size > 1 ? `${this.terms.issue} or redeem shares` : this.modeLabel.label
    )
    holdings = $derived.by((): CorporateFinanceHoldings | undefined => {
        const rules = this.session.rules.corporateFinanceRules
        const companyId = this.choices[0]?.companyId
        if (!rules || !companyId) return undefined
        const { state } = this.session
        const shares = (operation: FinanceChoice['operation']) =>
            rules
                .certificates(state, companyId, operation)
                .reduce(
                    (total, certificate) =>
                        total + (certificate.kind === 'share' ? certificate.shares : 0),
                    0
                )
        return {
            companyId,
            cash: finiteCashOwnedBy(state, { kind: 'company', companyId }),
            treasuryShares: shares('issue'),
            marketShares: shares('redeem'),
            ...(this.terms.issuePool
                ? {
                      issuePoolShares: certificatesInPool(
                          state,
                          this.terms.issuePool.poolId
                      ).filter((certificate) => certificate.companyId === companyId).length
                  }
                : {})
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
