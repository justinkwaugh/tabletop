import {
    clearStagedSelectionAtOrAfter,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

// The stack to move, as its space's key.
export type TzaarSelectionValues = {
    from: number
}

export type TzaarSelection = StagedSelectionState<TzaarSelectionValues>

export const TzaarStageOrder = ['from'] as const satisfies readonly (keyof TzaarSelectionValues)[]

type MissingStages = Exclude<keyof TzaarSelectionValues, (typeof TzaarStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setTzaarSelection<TStage extends keyof TzaarSelectionValues>(
    selection: TzaarSelection,
    stage: TStage,
    value: TzaarSelectionValues[TStage] | undefined
): TzaarSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<TzaarSelectionValues, TStage>(
              selection,
              TzaarStageOrder,
              stage
          )
        : setStagedSelectionValue<TzaarSelectionValues, TStage>(
              selection,
              TzaarStageOrder,
              stage,
              value,
              'manual'
          )
}
