import {
    clearStagedSelectionAtOrAfter,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

// The stack to move, as a point key.
export type LyngkSelectionValues = {
    from: number
}

export type LyngkSelection = StagedSelectionState<LyngkSelectionValues>

export const LyngkStageOrder = ['from'] as const satisfies readonly (keyof LyngkSelectionValues)[]
type MissingStages = Exclude<keyof LyngkSelectionValues, (typeof LyngkStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setLyngkSelection<TStage extends keyof LyngkSelectionValues>(
    selection: LyngkSelection,
    stage: TStage,
    value: LyngkSelectionValues[TStage] | undefined
): LyngkSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<LyngkSelectionValues, TStage>(
              selection,
              LyngkStageOrder,
              stage
          )
        : setStagedSelectionValue<LyngkSelectionValues, TStage>(
              selection,
              LyngkStageOrder,
              stage,
              value,
              'manual'
          )
}
