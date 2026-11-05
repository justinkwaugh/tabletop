import type { AxialCoordinates } from '@tabletop/common'
import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type GipfPotentialsSelectionValues = {
    from: AxialCoordinates
    to: AxialCoordinates
    dot: AxialCoordinates
    row: string
    keep: string[]
}

export type GipfPotentialsSelection = StagedSelectionState<GipfPotentialsSelectionValues>

// A move is either a potential's (its loaded piece, then where it goes: a GIPF-piece a PÜNCT
// covers waits for how many pieces cover it) or a push (its dot, then the line); rows are chosen,
// then the pieces in them to keep.
export const GipfPotentialsStageOrder = [
    'from',
    'to',
    'dot',
    'row',
    'keep'
] as const satisfies readonly (keyof GipfPotentialsSelectionValues)[]
type MissingStages = Exclude<
    keyof GipfPotentialsSelectionValues,
    (typeof GipfPotentialsStageOrder)[number]
>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setGipfPotentialsSelection<TStage extends keyof GipfPotentialsSelectionValues>(
    selection: GipfPotentialsSelection,
    stage: TStage,
    value: GipfPotentialsSelectionValues[TStage] | undefined
): GipfPotentialsSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<GipfPotentialsSelectionValues, TStage>(
              selection,
              GipfPotentialsStageOrder,
              stage
          )
        : setStagedSelectionValue<GipfPotentialsSelectionValues, TStage>(
              selection,
              GipfPotentialsStageOrder,
              stage,
              value,
              'manual'
          )
}

export function hasManualGipfPotentialsSelection(selection: GipfPotentialsSelection): boolean {
    return hasManualStagedSelection<GipfPotentialsSelectionValues>(
        selection,
        GipfPotentialsStageOrder
    )
}

export function popGipfPotentialsSelection(
    selection: GipfPotentialsSelection
): GipfPotentialsSelection {
    return popHighestManualStagedSelection<GipfPotentialsSelectionValues>(
        selection,
        GipfPotentialsStageOrder
    ).nextState
}
