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
    Pick<EighteenXXTitleRules, 'earningsRules' | 'receivershipRules'>
>

export class EarningsModule {
    readonly choice = singleChoice<EarningsChoice>()
    /** What is chosen for the revenue decided apart, while it is decided apart; Undo joins it to the rest. */
    readonly separate = singleChoice<EarningsChoice>()
    constructor(private readonly session: EarningsSession) {}

    private distributing = $derived.by(
        () => this.session.state.machineState === 'DistributingEarnings'
    )
    distribution = $derived.by(
        () =>
            new EarningsDistribution(
                this.session.state,
                this.session.rules.earningsRules,
                this.session.rules.receivershipRules
            )
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
    private companyId = $derived.by(() =>
        this.distributing ? this.session.state.routeStep?.companyId : undefined
    )
    /** The revenue the company may decide apart from the rest, where the run has both. */
    separateRevenue = $derived.by(() =>
        this.companyId ? this.distribution.separateRevenue(this.companyId) : 0
    )
    /** What is chosen for that revenue: nothing while it is decided with the rest. */
    separateChoice = $derived.by(() =>
        this.session.selectionsVisible && this.separateRevenue
            ? this.separate.value('choice')
            : undefined
    )
    /** The choices the revenue decided apart may take. */
    separateChoices = $derived.by((): EarningsChoice[] =>
        this.companyId && this.separateRevenue
            ? this.distribution.choices(this.companyId).filter((choice) => choice !== 'top-up')
            : []
    )
    choices = $derived.by(() => {
        const companyId = this.companyId
        const separate = this.separateChoice
        return companyId
            ? this.distribution.choices(companyId).map((choice) => ({
                  choice,
                  evaluation: this.distribution.evaluate(companyId, choice, separate)
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
    /** Decides the separate revenue apart with this choice, or with the rest again. */
    decideSeparately(choice: EarningsChoice | undefined) {
        assert(
            this.canDistribute && (!choice || this.separateChoices.includes(choice)),
            'Choose an available distribution'
        )
        if (choice) this.separate.choose('choice', choice)
        else this.separate.clear()
    }
    async confirm() {
        const details = this.preview
        assert(this.canDistribute && details, 'Choose an available distribution')
        await this.session.applyAction(
            this.session.createPlayerAction(DistributeEarnings, {
                companyId: details.companyId,
                choice: details.choice,
                ...(details.separate ? { separateChoice: details.separate.choice } : {})
            })
        )
    }
}
