import type { AxialCoordinates } from '@tabletop/common'
import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type MatrxSelectionValues = {
    from: AxialCoordinates
    dot: AxialCoordinates
    row: string
    keep: string[]
}

export type MatrxSelection = StagedSelectionState<MatrxSelectionValues>

// A move is either a potential's (its stack, then where it goes) or a push (its dot, then the
// line); rows are chosen, then the stacks in them to keep.
export const MatrxStageOrder = [
    'from',
    'dot',
    'row',
    'keep'
] as const satisfies readonly (keyof MatrxSelectionValues)[]
type MissingStages = Exclude<keyof MatrxSelectionValues, (typeof MatrxStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setMatrxSelection<TStage extends keyof MatrxSelectionValues>(
    selection: MatrxSelection,
    stage: TStage,
    value: MatrxSelectionValues[TStage] | undefined
): MatrxSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<MatrxSelectionValues, TStage>(
              selection,
              MatrxStageOrder,
              stage
          )
        : setStagedSelectionValue<MatrxSelectionValues, TStage>(
              selection,
              MatrxStageOrder,
              stage,
              value,
              'manual'
          )
}

export function hasManualMatrxSelection(selection: MatrxSelection): boolean {
    return hasManualStagedSelection<MatrxSelectionValues>(selection, MatrxStageOrder)
}

export function popMatrxSelection(selection: MatrxSelection): MatrxSelection {
    return popHighestManualStagedSelection<MatrxSelectionValues>(selection, MatrxStageOrder)
        .nextState
}
