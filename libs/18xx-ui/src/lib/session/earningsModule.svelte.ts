import { assert } from '@tabletop/common'
import {
    DistributeEarnings,
    EarningsDistribution,
    type DistributionState,
    type EarningsChoice,
    type EighteenXXState,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'
import { singleChoice } from './stagedSelection.svelte.js'

export type EarningsSession = ModuleSession<
    DistributionState & Pick<EighteenXXState, 'machineState'>,
    Pick<EighteenXXTitleRules, 'earningsRules'>
>

export class EarningsModule {
    readonly choice = singleChoice<EarningsChoice>()
    constructor(private readonly session: EarningsSession) {}

    private distributing = $derived.by(
        () => this.session.state.machineState === 'DistributingEarnings'
    )
    distribution = $derived.by(
        () => new EarningsDistribution(this.session.state, this.session.rules.earningsRules)
    )
    canDistribute = $derived.by(
        () =>
            this.session.interactive && this.session.validActionTypes.includes('DistributeEarnings')
    )
    selection = $derived.by(() =>
        this.session.selectionsVisible && this.distributing
            ? this.choice.value('choice')
            : undefined
    )
    choices = $derived.by(() => {
        const companyId = this.session.state.routeStep?.companyId
        return companyId && this.distributing
            ? this.session.rules.earningsRules
                  .choices(this.session.state, companyId)
                  .map((choice) => ({
                      choice,
                      evaluation: this.distribution.evaluate(companyId, choice)
                  }))
            : []
    })
    preview = $derived.by(
        () => this.choices.find((entry) => entry.choice === this.selection)?.evaluation.details
    )

    select(choice: EarningsChoice) {
        assert(
            this.canDistribute &&
                this.choices.some((entry) => entry.choice === choice && entry.evaluation.details),
            'Choose an available distribution'
        )
        this.choice.choose('choice', choice)
    }
    async confirm() {
        const details = this.preview
        assert(this.canDistribute && details, 'Choose an available distribution')
        await this.session.applyAction(
            this.session.createPlayerAction(DistributeEarnings, {
                companyId: details.companyId,
                choice: details.choice
            })
        )
    }
}
