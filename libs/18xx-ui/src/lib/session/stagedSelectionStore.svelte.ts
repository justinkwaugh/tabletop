import {
    getStagedSelectionEntry,
    getStagedSelectionValue,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionSource,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { LocalSelection } from './localSelections.js'

type StageKey<Stages> = Extract<keyof Stages, string>
export type UndoMode = 'clear-selection' | 'pop-stage'

export class StagedSelectionStore<Stages extends Record<string, unknown>> implements LocalSelection {
    state: StagedSelectionState<Stages> = $state({})
    constructor(
        private readonly order: readonly StageKey<Stages>[],
        private readonly undoMode: UndoMode = 'clear-selection'
    ) {}

    value<Stage extends StageKey<Stages>>(stage: Stage) {
        return getStagedSelectionValue<Stages, Stage>(this.state, stage)
    }
    entry<Stage extends StageKey<Stages>>(stage: Stage) {
        return getStagedSelectionEntry<Stages, Stage>(this.state, stage)
    }
    choose<Stage extends StageKey<Stages>>(
        stage: Stage,
        value: Stages[Stage],
        source: StagedSelectionSource = 'manual'
    ) {
        this.state = setStagedSelectionValue<Stages, Stage>(
            this.state,
            this.order,
            stage,
            value,
            source
        )
    }
    back(): boolean {
        const { nextState, poppedStage } = popHighestManualStagedSelection<Stages>(
            this.state,
            this.order
        )
        if (!poppedStage) return false
        this.state = nextState
        return true
    }

    hasManual() {
        return hasManualStagedSelection<Stages>(this.state, this.order)
    }
    undo() {
        if (this.undoMode === 'pop-stage') return this.back()
        if (!this.hasManual()) return false
        this.clear()
        return true
    }
    clear() {
        this.state = {}
    }
}

export type SingleChoice<Value> = { choice: Value }
export function singleChoiceStore<Value>(): StagedSelectionStore<SingleChoice<Value>> {
    return new StagedSelectionStore<SingleChoice<Value>>(['choice'])
}
