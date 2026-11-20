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

export class StagedDraft<TValues extends Record<string, unknown>> {
    private stages: StagedSelectionState<TValues> = $state.raw({})

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

    set<TStage extends StageOf<TValues>>(
        stage: TStage,
        value: TValues[TStage],
        source: StagedSelectionSource = 'manual'
    ): void {
        this.write(setStagedSelectionValue(this.read(), this.stageOrder, stage, value, source))
    }

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

    get allManual(): boolean {
        const stages = this.read()
        return this.stageOrder.every((stage) => stages[stage]?.source !== 'auto')
    }
}

/** Contract, Pick conventions: a lone legal choice as an `auto` stage; it never sends. */
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
