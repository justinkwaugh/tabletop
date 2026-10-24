import type { AxialCoordinates } from '@tabletop/common'
import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type GipfSelectionValues = {
    gipf: boolean
    dot: AxialCoordinates
    row: string
    keep: string[]
}

export type GipfSelection = StagedSelectionState<GipfSelectionValues>

export const GipfStageOrder = [
    'gipf',
    'dot',
    'row',
    'keep'
] as const satisfies readonly (keyof GipfSelectionValues)[]
type MissingStages = Exclude<keyof GipfSelectionValues, (typeof GipfStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setGipfSelection<TStage extends keyof GipfSelectionValues>(
    selection: GipfSelection,
    stage: TStage,
    value: GipfSelectionValues[TStage] | undefined
): GipfSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<GipfSelectionValues, TStage>(
              selection,
              GipfStageOrder,
              stage
          )
        : setStagedSelectionValue<GipfSelectionValues, TStage>(
              selection,
              GipfStageOrder,
              stage,
              value,
              'manual'
          )
}

export function hasManualGipfSelection(selection: GipfSelection): boolean {
    return hasManualStagedSelection<GipfSelectionValues>(selection, GipfStageOrder)
}

export function popGipfSelection(selection: GipfSelection): GipfSelection {
    return popHighestManualStagedSelection<GipfSelectionValues>(selection, GipfStageOrder).nextState
}

// Your choices for a push taken back, as you made them: the piece type only if there was one to
// choose, so each further Undo takes back one choice you made.
export function restagedGipfSelection(
    push: { gipf: boolean; dot: AxialCoordinates },
    typeChosen: boolean
): GipfSelection {
    const typed = typeChosen ? setGipfSelection({}, 'gipf', push.gipf) : {}
    return setGipfSelection(typed, 'dot', push.dot)
}
