import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

// The ring to move, and while taking a row the marker chosen as one end of it, as coordinate
// keys. Each belongs to its own machine state, so only one is ever set.
export type YinshSelectionValues = {
    from: string
    anchor: string
}

export type YinshSelection = StagedSelectionState<YinshSelectionValues>

export const YinshStageOrder = [
    'from',
    'anchor'
] as const satisfies readonly (keyof YinshSelectionValues)[]

type MissingStages = Exclude<keyof YinshSelectionValues, (typeof YinshStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setYinshSelection<TStage extends keyof YinshSelectionValues>(
    selection: YinshSelection,
    stage: TStage,
    value: YinshSelectionValues[TStage] | undefined
): YinshSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<YinshSelectionValues, TStage>(
              selection,
              YinshStageOrder,
              stage
          )
        : setStagedSelectionValue<YinshSelectionValues, TStage>(
              selection,
              YinshStageOrder,
              stage,
              value,
              'manual'
          )
}

export function hasManualYinshSelection(selection: YinshSelection): boolean {
    return hasManualStagedSelection<YinshSelectionValues>(selection, YinshStageOrder)
}

export function popYinshSelection(selection: YinshSelection): YinshSelection {
    return popHighestManualStagedSelection<YinshSelectionValues>(selection, YinshStageOrder)
        .nextState
}
