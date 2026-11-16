import {
    clearStagedSelectionAtOrAfter,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

// The stack to move, as a space key.
export type DvonnSelectionValues = {
    from: number
}

export type DvonnSelection = StagedSelectionState<DvonnSelectionValues>

export const DvonnStageOrder = ['from'] as const satisfies readonly (keyof DvonnSelectionValues)[]

type MissingStages = Exclude<keyof DvonnSelectionValues, (typeof DvonnStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setDvonnSelection<TStage extends keyof DvonnSelectionValues>(
    selection: DvonnSelection,
    stage: TStage,
    value: DvonnSelectionValues[TStage] | undefined
): DvonnSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<DvonnSelectionValues, TStage>(
              selection,
              DvonnStageOrder,
              stage
          )
        : setStagedSelectionValue<DvonnSelectionValues, TStage>(
              selection,
              DvonnStageOrder,
              stage,
              value,
              'manual'
          )
}
