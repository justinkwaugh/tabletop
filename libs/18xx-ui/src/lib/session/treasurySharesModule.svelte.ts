import { assert } from '@tabletop/common'
import {
    FinishTreasuryShares,
    TradeTreasuryShares,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type TreasuryShareChoice
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'

export type TreasurySharesSession = ModuleSession<
    EighteenXXState,
    Pick<EighteenXXTitleRules, 'treasuryShareRules'>
>

/** The operating company's share step: redeeming its shares or issuing them from its treasury. */
export class TreasurySharesModule {
    constructor(private readonly session: TreasurySharesSession) {}

    rules = $derived.by(() => this.session.rules.treasuryShareRules)
    companyId = $derived.by(() =>
        this.session.state.machineState === 'ManagingShares'
            ? this.session.state.shareStep?.companyId
            : undefined
    )
    choices = $derived.by((): readonly TreasuryShareChoice[] => {
        const { rules, companyId } = this
        return rules && companyId ? rules.choices(this.session.state, companyId) : []
    })
    canAct = $derived.by(
        () =>
            this.session.interactive &&
            this.session.validActionTypes.includes('FinishTreasuryShares')
    )
    async trade(choice: TreasuryShareChoice) {
        const companyId = this.companyId
        assert(this.canAct && companyId, 'No share operation is open')
        await this.session.applyAction(
            this.session.createPlayerAction(TradeTreasuryShares, {
                companyId,
                operation: choice.operation,
                certificateIds: [...choice.certificateIds],
                amount: choice.amount,
                ...(choice.poolId === undefined ? {} : { poolId: choice.poolId }),
                ...(choice.parPrice === undefined ? {} : { parPrice: choice.parPrice })
            })
        )
    }
    async finish() {
        const companyId = this.companyId
        assert(this.canAct && companyId, 'No share step is open')
        await this.session.applyAction(
            this.session.createPlayerAction(FinishTreasuryShares, { companyId })
        )
    }
}
