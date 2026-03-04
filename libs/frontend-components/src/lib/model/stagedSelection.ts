export type StagedSelectionSource = 'auto' | 'manual'

export type StagedSelectionEntry<TValue> = {
    value: TValue
    source: StagedSelectionSource
}

type StageKey<TValueByStage extends Record<string, unknown>> = Extract<
    keyof TValueByStage,
    string
>

export type StagedSelectionState<TValueByStage extends Record<string, unknown>> =
    Partial<{
        [TCurrentStage in StageKey<TValueByStage>]: StagedSelectionEntry<TValueByStage[TCurrentStage]>
    }>

function stageIndex<TValueByStage extends Record<string, unknown>>(
    stageOrder: readonly StageKey<TValueByStage>[],
    stage: StageKey<TValueByStage>
): number {
    return stageOrder.indexOf(stage)
}

export function setStagedSelectionValue<
    TValueByStage extends Record<string, unknown>,
    TCurrentStage extends StageKey<TValueByStage>
>(
    currentState: StagedSelectionState<TValueByStage>,
    stageOrder: readonly StageKey<TValueByStage>[],
    stage: TCurrentStage,
    value: TValueByStage[TCurrentStage],
    source: StagedSelectionSource
): StagedSelectionState<TValueByStage> {
    const targetIndex = stageIndex(stageOrder, stage)
    if (targetIndex < 0) {
        throw new Error(`Stage "${stage}" does not exist in stage order`)
    }

    const nextState = {
        ...currentState,
        [stage]: { value, source }
    } as StagedSelectionState<TValueByStage>

    for (let index = targetIndex + 1; index < stageOrder.length; index += 1) {
        const laterStage = stageOrder[index]
        delete nextState[laterStage]
    }

    return nextState
}

export function clearStagedSelectionAtOrAfter<
    TValueByStage extends Record<string, unknown>,
    TCurrentStage extends StageKey<TValueByStage>
>(
    currentState: StagedSelectionState<TValueByStage>,
    stageOrder: readonly StageKey<TValueByStage>[],
    stage: TCurrentStage
): StagedSelectionState<TValueByStage> {
    const targetIndex = stageIndex(stageOrder, stage)
    if (targetIndex < 0) {
        throw new Error(`Stage "${stage}" does not exist in stage order`)
    }

    const nextState = { ...currentState }
    for (let index = targetIndex; index < stageOrder.length; index += 1) {
        const stageToClear = stageOrder[index]
        delete nextState[stageToClear]
    }

    return nextState
}

export function getStagedSelectionEntry<
    TValueByStage extends Record<string, unknown>,
    TCurrentStage extends StageKey<TValueByStage>
>(
    state: StagedSelectionState<TValueByStage>,
    stage: TCurrentStage
): StagedSelectionEntry<TValueByStage[TCurrentStage]> | undefined {
    return state[stage] as StagedSelectionEntry<TValueByStage[TCurrentStage]> | undefined
}

export function getStagedSelectionValue<
    TValueByStage extends Record<string, unknown>,
    TCurrentStage extends StageKey<TValueByStage>
>(
    state: StagedSelectionState<TValueByStage>,
    stage: TCurrentStage
): TValueByStage[TCurrentStage] | undefined {
    return getStagedSelectionEntry(state, stage)?.value
}

export function getHighestManualStagedSelectionStage<
    TValueByStage extends Record<string, unknown>
>(
    state: StagedSelectionState<TValueByStage>,
    stageOrder: readonly StageKey<TValueByStage>[]
): StageKey<TValueByStage> | undefined {
    for (let index = stageOrder.length - 1; index >= 0; index -= 1) {
        const stage = stageOrder[index]
        if (state[stage]?.source === 'manual') {
            return stage
        }
    }

    return undefined
}

export function hasManualStagedSelection<
    TValueByStage extends Record<string, unknown>
>(
    state: StagedSelectionState<TValueByStage>,
    stageOrder: readonly StageKey<TValueByStage>[]
): boolean {
    return getHighestManualStagedSelectionStage(state, stageOrder) !== undefined
}

export function popHighestManualStagedSelection<
    TValueByStage extends Record<string, unknown>
>(state: StagedSelectionState<TValueByStage>, stageOrder: readonly StageKey<TValueByStage>[]): {
    nextState: StagedSelectionState<TValueByStage>
    poppedStage?: StageKey<TValueByStage>
} {
    const poppedStage = getHighestManualStagedSelectionStage(state, stageOrder)
    if (!poppedStage) {
        return { nextState: state }
    }

    return {
        nextState: clearStagedSelectionAtOrAfter(state, stageOrder, poppedStage),
        poppedStage
    }
}
