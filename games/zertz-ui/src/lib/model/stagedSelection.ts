import type { AxialCoordinates } from '@tabletop/common'
import type { MarbleColor } from '@tabletop/zertz'
import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type ZertzSelectionValues = {
    color: MarbleColor
    place: AxialCoordinates
    jumper: AxialCoordinates
}

export type ZertzSelection = StagedSelectionState<ZertzSelectionValues>

// The marble's colour, then the ring it stands on until a ring is chosen to remove.
export const ZertzStageOrder = [
    'color',
    'place',
    'jumper'
] as const satisfies readonly (keyof ZertzSelectionValues)[]
type MissingStages = Exclude<keyof ZertzSelectionValues, (typeof ZertzStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setZertzSelection<TStage extends keyof ZertzSelectionValues>(
    selection: ZertzSelection,
    stage: TStage,
    value: ZertzSelectionValues[TStage] | undefined
): ZertzSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<ZertzSelectionValues, TStage>(
              selection,
              ZertzStageOrder,
              stage
          )
        : setStagedSelectionValue<ZertzSelectionValues, TStage>(
              selection,
              ZertzStageOrder,
              stage,
              value,
              'manual'
          )
}

export function hasManualZertzSelection(selection: ZertzSelection): boolean {
    return hasManualStagedSelection<ZertzSelectionValues>(selection, ZertzStageOrder)
}

export function popZertzSelection(selection: ZertzSelection): ZertzSelection {
    return popHighestManualStagedSelection<ZertzSelectionValues>(selection, ZertzStageOrder)
        .nextState
}

// A move Undo took back stands staged again: its marble on its ring, its colour chosen when there
// was a choice.
export function restagedZertzSelection(
    move: { color: MarbleColor; coords: AxialCoordinates },
    colorChosen: boolean
): ZertzSelection {
    const colored = colorChosen ? setZertzSelection({}, 'color', move.color) : {}
    return setZertzSelection(colored, 'place', move.coords)
}
