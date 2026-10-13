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

/** A panel's draft as the session sees it: Undo unwinds it before any sent action, and a new state ends it. */
export interface PanelDraft {
    hasManualSelection(): boolean
    back(): boolean
    reset(): void
}

const TAP_STAGE_ORDER = ['taps'] as const
const _tapStagesAreCovered: StagesCover<{ taps: unknown[] }, typeof TAP_STAGE_ORDER> = true
void _tapStagesAreCovered

/**
 * A panel draft that keeps its value after each tap, so Undo takes back the last tap, then the one
 * before; Undo that lands on a value with nothing picked leaves the panel as it opened.
 */
export abstract class TapHistoryDraft<V> implements PanelDraft {
    private flow = new StagedFlow<{ taps: V[] }>(TAP_STAGE_ORDER)

    /** `opened` is the value before any tap. */
    constructor(private readonly opened: V) {}

    /** The value after the last tap. */
    protected get current(): V {
        return this.flow.value('taps')?.at(-1) ?? this.opened
    }

    /** Nothing in the value is picked. */
    protected abstract isBare(value: V): boolean

    // A tap that changes nothing is no pick for Undo to take back.
    protected tap(next: V): void {
        if (JSON.stringify(this.current) === JSON.stringify(next)) return
        this.flow.set('taps', [...(this.flow.value('taps') ?? []), next])
    }

    hasManualSelection(): boolean {
        return this.flow.hasManualSelection()
    }

    back(): boolean {
        const taps = this.flow.value('taps')
        const before = taps?.at(-2)
        if (taps === undefined || before === undefined || this.isBare(before)) {
            return this.flow.back() !== undefined
        }
        this.flow.set('taps', taps.slice(0, -1))
        return true
    }

    reset(): void {
        this.flow.reset()
    }
}
