import type { AxialCoordinates } from '@tabletop/common'
import {
    clearStagedSelectionAtOrAfter,
    pushStagedSelectionValue,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type GipfSelectionValues = {
    gipf: boolean
    dot: AxialCoordinates
    row: string
    keep: number[]
}

export type GipfSelection = StagedSelectionState<GipfSelectionValues>

// The piece type follows the dot: it drops single, and choosing it again makes it a GIPF-piece.
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

// A stacked stage, so Undo takes back one tap at a time.
export function pushGipfKeep(selection: GipfSelection, keep: number[]): GipfSelection {
    return pushStagedSelectionValue<GipfSelectionValues, 'keep'>(
        selection,
        GipfStageOrder,
        'keep',
        keep
    )
}

// Only the choices you made, so each further Undo takes back one of them.
export function restagedGipfSelection(
    push: { gipf: boolean; dot: AxialCoordinates },
    typeChosen: boolean
): GipfSelection {
    const onDot = setGipfSelection({}, 'dot', push.dot)
    return typeChosen && push.gipf ? setGipfSelection(onDot, 'gipf', true) : onDot
}
