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

// The piece type follows the dot: the piece drops onto its dot as a single piece, and choosing it
// again makes it a GIPF-piece.
export const GipfStageOrder = [
    'dot',
    'gipf',
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

// Your choices for a push taken back, as you made them: a GIPF-piece only if you made it one, so
// each further Undo takes back one choice you made.
export function restagedGipfSelection(
    push: { gipf: boolean; dot: AxialCoordinates },
    typeChosen: boolean
): GipfSelection {
    const onDot = setGipfSelection({}, 'dot', push.dot)
    return typeChosen && push.gipf ? setGipfSelection(onDot, 'gipf', true) : onDot
}
