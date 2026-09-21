import { assert } from '@tabletop/common'
import {
    DistributeEarnings,
    EarningsDistribution,
    type DistributionState,
    type EarningsChoice,
    type EighteenXXState,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import type { SessionContext } from './sessionContext.js'
import type { SessionDraft } from './sessionDrafts.js'

export type EarningsContext = SessionContext<
    DistributionState & Pick<EighteenXXState, 'machineState'>,
    Pick<EighteenXXTitleRules, 'earningsRules'>
>

export class EarningsModule implements SessionDraft {
    #draft: EarningsChoice | undefined = $state()
    constructor(private readonly context: EarningsContext) {}

    private distributing = $derived.by(() => this.context.state.machineState === 'DistributingEarnings')
    distribution = $derived.by(
        () => new EarningsDistribution(this.context.state, this.context.rules.earningsRules)
    )
    canDistribute = $derived.by(() => this.context.interactive && this.context.validActionTypes.includes('DistributeEarnings'))
    selection = $derived.by(() => this.context.draftsVisible && this.distributing ? this.#draft : undefined)
    choices = $derived.by(() => {
        const companyId = this.context.state.routeStep?.companyId
        return companyId && this.distributing
            ? this.context.rules.earningsRules
                  .choices(this.context.state, companyId)
                  .map((choice) => ({
                      choice,
                      evaluation: this.distribution.evaluate(companyId, choice)
                  }))
            : []
    })
    preview = $derived.by(() => this.choices.find((entry) => entry.choice === this.selection)?.evaluation.details)

    select(choice: EarningsChoice) {
        assert(
            this.canDistribute &&
                this.choices.some((entry) => entry.choice === choice && entry.evaluation.details),
            'Choose an available distribution'
        )
        this.#draft = choice
    }
    async confirm() {
        const details = this.preview
        assert(this.canDistribute && details, 'Choose an available distribution')
        await this.context.applyAction(this.context.createPlayerAction(DistributeEarnings, {
            companyId: details.companyId,
            choice: details.choice
        }))
    }

    pending() {
        return this.#draft !== undefined
    }
    unwind() {
        if (this.#draft === undefined) return false
        this.#draft = undefined
        return true
    }
    clear() {
        this.#draft = undefined
    }
}
