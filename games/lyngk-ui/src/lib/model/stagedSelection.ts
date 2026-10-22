import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

// The stack to move, as a coordinate key.
export type LyngkSelectionValues = {
    from: string
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

export function hasManualLyngkSelection(selection: LyngkSelection): boolean {
    return hasManualStagedSelection<LyngkSelectionValues>(selection, LyngkStageOrder)
}

export function popLyngkSelection(selection: LyngkSelection): LyngkSelection {
    return popHighestManualStagedSelection<LyngkSelectionValues>(selection, LyngkStageOrder)
        .nextState
}
