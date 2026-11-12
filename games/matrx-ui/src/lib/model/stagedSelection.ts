import type { AxialCoordinates } from '@tabletop/common'
import {
    clearStagedSelectionAtOrAfter,
    pushStagedSelectionValue,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type MatrxSelectionValues = {
    from: AxialCoordinates
    dot: AxialCoordinates
    row: string
    keep: number[]
}

export type MatrxSelection = StagedSelectionState<MatrxSelectionValues>

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

// A stacked stage, so Undo takes back one tap at a time.
export function pushMatrxKeep(selection: MatrxSelection, keep: number[]): MatrxSelection {
    return pushStagedSelectionValue<MatrxSelectionValues, 'keep'>(
        selection,
        MatrxStageOrder,
        'keep',
        keep
    )
}
