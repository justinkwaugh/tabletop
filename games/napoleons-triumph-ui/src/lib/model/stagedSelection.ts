import {
    clearStagedSelectionAtOrAfter,
    getStagedSelectionValue,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionSource,
    type StagedSelectionState
} from '@tabletop/frontend-components'

type Stage<Values> = Extract<keyof Values, string>

type CoveringOrder<Values, Order extends readonly string[]> =
    Exclude<Stage<Values>, Order[number]> extends never ? Order : never

export interface StagedSelection<Values extends Record<string, unknown>> {
    readonly order: readonly Stage<Values>[]
    empty(): StagedSelectionState<Values>
    set<Current extends Stage<Values>>(
        state: StagedSelectionState<Values>,
        stage: Current,
        value: Values[Current],
        source: StagedSelectionSource
    ): StagedSelectionState<Values>
    clearFrom(
        state: StagedSelectionState<Values>,
        stage: Stage<Values>
    ): StagedSelectionState<Values>
    value<Current extends Stage<Values>>(
        state: StagedSelectionState<Values>,
        stage: Current
    ): Values[Current] | undefined
    hasManual(state: StagedSelectionState<Values>): boolean
    undo(state: StagedSelectionState<Values>): StagedSelectionState<Values>
}

export function stagedSelection<Values extends Record<string, unknown>>() {
    return <const Order extends readonly Stage<Values>[]>(
        order: CoveringOrder<Values, Order>
    ): StagedSelection<Values> => ({
        order,
        empty: () => ({}),
        set: (state, stage, value, source) =>
            setStagedSelectionValue<Values, typeof stage>(state, order, stage, value, source),
        clearFrom: (state, stage) =>
            clearStagedSelectionAtOrAfter<Values, typeof stage>(state, order, stage),
        value: (state, stage) => getStagedSelectionValue<Values, typeof stage>(state, stage),
        hasManual: (state) => hasManualStagedSelection<Values>(state, order),
        undo: (state) => popHighestManualStagedSelection<Values>(state, order).nextState
    })
}
