import {
    clearStagedSelectionAtOrAfter,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

// The ring to move, and while taking a row the marker chosen as one end of it, as point keys.
// Each belongs to its own machine state, so only one is ever set.
export type YinshSelectionValues = {
    from: number
    anchor: number
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
