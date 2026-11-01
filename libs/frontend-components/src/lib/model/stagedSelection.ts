import type { LocalSelection } from './localSelections.js'

export type StagedSelectionSource = 'auto' | 'manual'

export type StagedSelectionEntry<TValue> = {
    value: TValue
    source: StagedSelectionSource
    previous?: StagedSelectionEntry<TValue>
}

type StageKey<TValueByStage extends Record<string, unknown>> = Extract<keyof TValueByStage, string>

export type StagedSelectionState<TValueByStage extends Record<string, unknown>> = Partial<{
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

/**
 * Sets a stage as one manual press that Undo takes back alone: popping the stage restores the
 * value this press replaced instead of clearing the stage. Clears every later stage, as setting does.
 */
export function pushStagedSelectionValue<
    TValueByStage extends Record<string, unknown>,
    TCurrentStage extends StageKey<TValueByStage>
>(
    currentState: StagedSelectionState<TValueByStage>,
    stageOrder: readonly StageKey<TValueByStage>[],
    stage: TCurrentStage,
    value: TValueByStage[TCurrentStage]
): StagedSelectionState<TValueByStage> {
    const previous = getStagedSelectionEntry(currentState, stage)
    const nextState = setStagedSelectionValue(currentState, stageOrder, stage, value, 'manual')
    if (previous) {
        nextState[stage] = { value, source: 'manual', previous }
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

export function getHighestManualStagedSelectionStage<TValueByStage extends Record<string, unknown>>(
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

export function hasManualStagedSelection<TValueByStage extends Record<string, unknown>>(
    state: StagedSelectionState<TValueByStage>,
    stageOrder: readonly StageKey<TValueByStage>[]
): boolean {
    return getHighestManualStagedSelectionStage(state, stageOrder) !== undefined
}

export function popHighestManualStagedSelection<TValueByStage extends Record<string, unknown>>(
    state: StagedSelectionState<TValueByStage>,
    stageOrder: readonly StageKey<TValueByStage>[]
): {
    nextState: StagedSelectionState<TValueByStage>
    poppedStage?: StageKey<TValueByStage>
} {
    const poppedStage = getHighestManualStagedSelectionStage(state, stageOrder)
    if (!poppedStage) {
        return { nextState: state }
    }

    const nextState = clearStagedSelectionAtOrAfter(state, stageOrder, poppedStage)
    const previous = getStagedSelectionEntry(state, poppedStage)?.previous
    if (previous) {
        nextState[poppedStage] = previous
    }
    return { nextState, poppedStage }
}

/**
 * A staged selection as a session's contextual Undo sees it: Undo pops its highest manual stage
 * and reports nothing to pop, so the session can undo the last action instead.
 */
export function undoableStagedSelection<TValueByStage extends Record<string, unknown>>(
    stageOrder: readonly StageKey<TValueByStage>[],
    read: () => StagedSelectionState<TValueByStage>,
    write: (state: StagedSelectionState<TValueByStage>) => void
): LocalSelection {
    return {
        hasManual: () => hasManualStagedSelection(read(), stageOrder),
        undo: () => {
            const { nextState, poppedStage } = popHighestManualStagedSelection(read(), stageOrder)
            if (!poppedStage) return false
            write(nextState)
            return true
        },
        clear: () => write({})
    }
}
