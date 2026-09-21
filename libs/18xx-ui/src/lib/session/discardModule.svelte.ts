import { assert } from '@tabletop/common'
import {
    DiscardTrain,
    discardableTrains,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type PhaseChangeState
} from '@tabletop/18xx'
import type { SessionContext } from './sessionContext.js'
import type { SessionDraft } from './sessionDrafts.js'

export type DiscardContext = SessionContext<
    PhaseChangeState & Pick<EighteenXXState, 'machineState'>,
    { trainRules: Pick<EighteenXXTitleRules['trainRules'], 'trainLimit'> }
>

export class DiscardModule implements SessionDraft {
    #draft: string | undefined = $state()
    constructor(private readonly context: DiscardContext) {}

    selection = $derived.by(() => this.context.draftsVisible && this.context.state.machineState === 'DiscardingTrains'
            ? this.#draft
            : undefined)
    companyId = $derived.by(() => this.context.state.phaseChange?.discardCompanyIds[0])
    trains = $derived.by(() => this.companyId
            ? discardableTrains(this.context.state, this.companyId, this.context.rules.trainRules)
            : [])
    excess = $derived.by(() => this.companyId
            ? this.trains.length -
                  this.context.rules.trainRules.trainLimit(this.context.state, this.companyId)
            : 0)
    canDiscard = $derived.by(() => this.context.interactive && this.context.validActionTypes.includes('DiscardTrain'))

    select(trainId: string) {
        assert(
            this.canDiscard && this.trains.some((train) => train.id === trainId),
            'Choose a train for compulsory discard'
        )
        this.#draft = trainId
    }
    async confirm() {
        const companyId = this.companyId
        const trainId = this.selection
        assert(this.canDiscard && companyId && trainId, 'Select a train to discard')
        await this.context.applyAction(this.context.createPlayerAction(DiscardTrain, { companyId, trainId }))
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
