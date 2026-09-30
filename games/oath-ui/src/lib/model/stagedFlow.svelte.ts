import {
    clearStagedSelectionAtOrAfter,
    getHighestManualStagedSelectionStage,
    getStagedSelectionEntry,
    getStagedSelectionValue,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionSource,
    type StagedSelectionState
} from '@tabletop/frontend-components'

type StageOf<V extends Record<string, unknown>> = Extract<keyof V, string>

// `docs/user-interactions.md` requires each flow's stage order and value map to be checked
// against each other at compile time; a flow asserts `StagesCover<…> = true`.
export type StagesCover<V extends Record<string, unknown>, O extends readonly string[]> =
    Exclude<StageOf<V>, O[number]> extends never
        ? Exclude<O[number], StageOf<V>> extends never
            ? true
            : ['stage order has a stage the value map does not']
        : ['value map has a key the stage order does not']

/** One staged selection flow over the shared helpers, in its own stage order. */
export class StagedFlow<V extends Record<string, unknown>> {
    stages: StagedSelectionState<V> = $state({})

    constructor(private readonly order: readonly StageOf<V>[]) {}

    value<S extends StageOf<V>>(stage: S): V[S] | undefined {
        return getStagedSelectionValue<V, S>(this.stages, stage)
    }

    sourceOf(stage: StageOf<V>): StagedSelectionSource | undefined {
        return getStagedSelectionEntry<V, StageOf<V>>(this.stages, stage)?.source
    }

    set<S extends StageOf<V>>(stage: S, value: V[S], source: StagedSelectionSource = 'manual') {
        this.stages = setStagedSelectionValue(this.stages, this.order, stage, value, source)
    }

    // A manual pick of the same value stays manual, so Undo still steps back through it.
    autoSelect<S extends StageOf<V>>(stage: S, value: V[S]): void {
        if (getStagedSelectionEntry<V, S>(this.stages, stage)?.value === value) return
        this.set(stage, value, 'auto')
    }

    clearFrom(stage: StageOf<V>): void {
        this.stages = clearStagedSelectionAtOrAfter(this.stages, this.order, stage)
    }

    hasManualSelection(): boolean {
        return hasManualStagedSelection(this.stages, this.order)
    }

    highestManualStage(): StageOf<V> | undefined {
        return getHighestManualStagedSelectionStage<V>(this.stages, this.order)
    }

    back(): StageOf<V> | undefined {
        const { nextState, poppedStage } = popHighestManualStagedSelection<V>(
            this.stages,
            this.order
        )
        this.stages = nextState
        return poppedStage
    }

    reset(): void {
        this.stages = {}
    }
}

/** A panel's draft as the session sees it: Back unwinds it, Undo waits for it, a new state ends it. */
export interface PanelDraft {
    hasManualSelection(): boolean
    back(): boolean
    reset(): void
}
