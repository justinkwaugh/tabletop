import type { AxialCoordinates } from '@tabletop/common'
import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type PunctSelectionValues = {
    from: AxialCoordinates
    at: AxialCoordinates
    rotation: number
}

export type PunctSelection = StagedSelectionState<PunctSelectionValues>

// A move chooses the piece by its PÜNCT, then where the PÜNCT goes, then how the piece turns
// there; a new piece skips the first.
export const PunctStageOrder = [
    'from',
    'at',
    'rotation'
] as const satisfies readonly (keyof PunctSelectionValues)[]
type MissingStages = Exclude<keyof PunctSelectionValues, (typeof PunctStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setPunctSelection<TStage extends keyof PunctSelectionValues>(
    selection: PunctSelection,
    stage: TStage,
    value: PunctSelectionValues[TStage] | undefined
): PunctSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<PunctSelectionValues, TStage>(
              selection,
              PunctStageOrder,
              stage
          )
        : setStagedSelectionValue<PunctSelectionValues, TStage>(
              selection,
              PunctStageOrder,
              stage,
              value,
              'manual'
          )
}

export function hasManualPunctSelection(selection: PunctSelection): boolean {
    return hasManualStagedSelection<PunctSelectionValues>(selection, PunctStageOrder)
}

export function popPunctSelection(selection: PunctSelection): PunctSelection {
    return popHighestManualStagedSelection<PunctSelectionValues>(selection, PunctStageOrder)
        .nextState
}
