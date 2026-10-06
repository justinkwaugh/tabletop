import type { FountainId, QueueEnd } from '@tabletop/marracash'
import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

// A pawn sets both parts at once and the panel buttons one at a time; either way it is one
// staged choice, so Back clears it whole.
export type RefillDraft = { end?: QueueEnd; count?: number }

export type MarracashSelectionValues = {
    fountain: FountainId
    refill: RefillDraft
}

export type MarracashSelection = StagedSelectionState<MarracashSelectionValues>

export const MarracashStageOrder = [
    'fountain',
    'refill'
] as const satisfies readonly (keyof MarracashSelectionValues)[]
type MissingStages = Exclude<keyof MarracashSelectionValues, (typeof MarracashStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setMarracashSelection<TStage extends keyof MarracashSelectionValues>(
    selection: MarracashSelection,
    stage: TStage,
    value: MarracashSelectionValues[TStage] | undefined
): MarracashSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<MarracashSelectionValues, TStage>(
              selection,
              MarracashStageOrder,
              stage
          )
        : setStagedSelectionValue<MarracashSelectionValues, TStage>(
              selection,
              MarracashStageOrder,
              stage,
              value,
              'manual'
          )
}

export function updateMarracashRefill(
    selection: MarracashSelection,
    change: RefillDraft
): MarracashSelection {
    return setMarracashSelection(selection, 'refill', { ...selection.refill?.value, ...change })
}

export function hasManualMarracashSelection(selection: MarracashSelection): boolean {
    return hasManualStagedSelection<MarracashSelectionValues>(selection, MarracashStageOrder)
}

export function popMarracashSelection(selection: MarracashSelection): MarracashSelection {
    return popHighestManualStagedSelection<MarracashSelectionValues>(selection, MarracashStageOrder)
        .nextState
}
