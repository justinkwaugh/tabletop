import {
    clearStagedSelectionAtOrAfter,
    getStagedSelectionEntry,
    getStagedSelectionValue,
    hasManualStagedSelection,
    pushStagedSelectionValue,
    setStagedSelectionValue,
    undoableStagedSelection,
    type LocalSelection,
    type StagedSelectionEntry,
    type StagedSelectionSource,
    type StagedSelectionState
} from '@tabletop/frontend-components'

type StageOf<TValues extends Record<string, unknown>> = Extract<keyof TValues, string>

/**
 * One staged flow's draft: the session owns one for each flow, registers `localSelection`, and
 * components read it and press through the session. A subclass names the flow's stages and presses.
 */
export class StagedDraft<TValues extends Record<string, unknown>> {
    private stages: StagedSelectionState<TValues> = $state.raw({})

    /** Undo pops through this; a draft that reads stages conditionally overrides `read`. */
    readonly localSelection: LocalSelection

    constructor(readonly stageOrder: readonly StageOf<TValues>[]) {
        this.localSelection = undoableStagedSelection(
            stageOrder,
            () => this.read(),
            (stages) => this.write(stages)
        )
    }

    protected read(): StagedSelectionState<TValues> {
        return this.stages
    }

    protected write(stages: StagedSelectionState<TValues>): void {
        this.stages = stages
    }

    get selection(): StagedSelectionState<TValues> {
        return this.read()
    }

    entry<TStage extends StageOf<TValues>>(
        stage: TStage
    ): StagedSelectionEntry<TValues[TStage]> | undefined {
        return getStagedSelectionEntry(this.read(), stage)
    }

    value<TStage extends StageOf<TValues>>(stage: TStage): TValues[TStage] | undefined {
        return getStagedSelectionValue(this.read(), stage)
    }

    /** Sets a stage and clears every later one. A second set replaces it, with no history. */
    set<TStage extends StageOf<TValues>>(
        stage: TStage,
        value: TValues[TStage],
        source: StagedSelectionSource = 'manual'
    ): void {
        this.write(setStagedSelectionValue(this.read(), this.stageOrder, stage, value, source))
    }

    /** One manual press on a stacked stage: Undo restores the value it replaced. */
    push<TStage extends StageOf<TValues>>(stage: TStage, value: TValues[TStage]): void {
        this.write(pushStagedSelectionValue(this.read(), this.stageOrder, stage, value))
    }

    clearFrom(stage: StageOf<TValues>): void {
        this.write(clearStagedSelectionAtOrAfter(this.read(), this.stageOrder, stage))
    }

    clear(): void {
        this.localSelection.clear()
    }

    get hasManual(): boolean {
        return hasManualStagedSelection(this.read(), this.stageOrder)
    }

    /** Every filled stage came from a press, so a completing press may send. */
    get allManual(): boolean {
        const stages = this.read()
        return this.stageOrder.every((stage) => stages[stage]?.source !== 'auto')
    }
}

/**
 * A lone legal choice as an `auto` stage (contract: Pick conventions). Stage-gated: a filled stage
 * stays as it is. Cardinality-gated: only exactly one choice. Idempotent, and it never sends, so a
 * draft can read through it with no effect.
 */
export function withLoneChoice<
    TValues extends Record<string, unknown>,
    TStage extends StageOf<TValues>
>(
    stages: StagedSelectionState<TValues>,
    stageOrder: readonly StageOf<TValues>[],
    stage: TStage,
    choices: readonly TValues[TStage][]
): StagedSelectionState<TValues> {
    if (choices.length !== 1 || getStagedSelectionEntry(stages, stage)) {
        return stages
    }
    return setStagedSelectionValue(stages, stageOrder, stage, choices[0], 'auto')
}
