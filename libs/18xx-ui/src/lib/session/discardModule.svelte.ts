import { assert } from '@tabletop/common'
import {
    DiscardTrain,
    discardableTrains,
    isAdvancePhase,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type PhaseChangeState,
    type Train,
    type TrainRules
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'
import { singleChoice } from './stagedSelection.svelte.js'

export type DiscardSession = ModuleSession<
    PhaseChangeState & Pick<EighteenXXState, 'machineState'>,
    { trainRules: Pick<EighteenXXTitleRules['trainRules'], 'trainLimit' | 'countsForLimit'> }
>

export type PendingDiscard = {
    companyId: string
    trains: Train[]
    limit: number
    excess: number
}

export function pendingDiscard(
    state: PhaseChangeState,
    trainRules: Pick<TrainRules, 'trainLimit' | 'countsForLimit'>
): PendingDiscard | undefined {
    const companyId = state.phaseChange?.discardCompanyIds[0]
    if (!companyId) return undefined
    const trains = discardableTrains(state, companyId, trainRules)
    const limit = trainRules.trainLimit(state, companyId)
    return { companyId, trains, limit, excess: trains.length - limit }
}

export class DiscardModule {
    readonly choice = singleChoice<string>()
    constructor(private readonly session: DiscardSession) {}

    selection = $derived.by(() =>
        this.session.selectionsVisible && this.session.state.machineState === 'DiscardingTrains'
            ? this.choice.value('choice')
            : undefined
    )
    #pending = $derived.by(() => pendingDiscard(this.session.state, this.session.rules.trainRules))
    companyId = $derived(this.#pending?.companyId)
    phaseEvent = $derived.by(() => {
        const id = this.session.state.phaseChange?.event.id
        if (!id) return undefined
        return this.session.recordedActions.flatMap((action) =>
            isAdvancePhase(action) && action.metadata?.event.id === id
                ? [action.metadata.event]
                : []
        )[0]
    })
    trains = $derived(this.#pending?.trains ?? [])
    excess = $derived(this.#pending?.excess ?? 0)
    canDiscard = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('DiscardTrain')
    )

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
        await this.session.applyAction(
            this.session.createPlayerAction(DiscardTrain, { companyId, trainId })
        )
    }
}
