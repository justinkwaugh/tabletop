import type { AxialCoordinates } from '@tabletop/common'
import {
    clearStagedSelectionAtOrAfter,
    pushStagedSelectionValue,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type GipfPotentialsSelectionValues = {
    from: AxialCoordinates
    to: AxialCoordinates
    dot: AxialCoordinates
    row: string
    keep: number[]
}

export type GipfPotentialsSelection = StagedSelectionState<GipfPotentialsSelectionValues>

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

// A stacked stage, so Undo takes back one tap at a time.
export function pushGipfPotentialsKeep(
    selection: GipfPotentialsSelection,
    keep: number[]
): GipfPotentialsSelection {
    return pushStagedSelectionValue<GipfPotentialsSelectionValues, 'keep'>(
        selection,
        GipfPotentialsStageOrder,
        'keep',
        keep
    )
}
