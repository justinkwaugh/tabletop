import { assert } from '@tabletop/common'
import {
    DiscardTrain,
    discardableTrains,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type PhaseChangeState
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'
import { singleChoice } from './stagedSelection.svelte.js'

export type DiscardSession = ModuleSession<
    PhaseChangeState & Pick<EighteenXXState, 'machineState'>,
    { trainRules: Pick<EighteenXXTitleRules['trainRules'], 'trainLimit'> }
>

export class DiscardModule {
    readonly choice = singleChoice<string>()
    constructor(private readonly session: DiscardSession) {}

    selection = $derived.by(() => this.session.selectionsVisible && this.session.state.machineState === 'DiscardingTrains'
            ? this.choice.value('choice')
            : undefined)
    companyId = $derived.by(() => this.session.state.phaseChange?.discardCompanyIds[0])
    trains = $derived.by(() => this.companyId
            ? discardableTrains(this.session.state, this.companyId, this.session.rules.trainRules)
            : [])
    excess = $derived.by(() => this.companyId
            ? this.trains.length -
                  this.session.rules.trainRules.trainLimit(this.session.state, this.companyId)
            : 0)
    canDiscard = $derived.by(() => this.session.interactive && this.session.validActionTypes.includes('DiscardTrain'))

    select(trainId: string) {
        assert(
            this.canDiscard && this.trains.some((train) => train.id === trainId),
            'Choose a train for compulsory discard'
        )
        this.choice.choose('choice', trainId)
    }
    async confirm() {
        const companyId = this.companyId
        const trainId = this.selection
        assert(this.canDiscard && companyId && trainId, 'Select a train to discard')
        await this.session.applyAction(this.session.createPlayerAction(DiscardTrain, { companyId, trainId }))
    }
}
