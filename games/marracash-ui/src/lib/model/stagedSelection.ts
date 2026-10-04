import type { FountainId, QueueEnd, ShopId } from '@tabletop/marracash'
import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type MarracashSelectionValues = {
    fountain: FountainId
    destination: FountainId
    shop: ShopId
    queueEnd: QueueEnd
    visitorCount: number
}

export type MarracashSelection = StagedSelectionState<MarracashSelectionValues>

export const MarracashStageOrder = [
    'fountain',
    'destination',
    'shop',
    'queueEnd',
    'visitorCount'
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

// Valid counts depend only on the queue's length, so a chosen count survives switching ends.
export function setMarracashQueueEnd(
    selection: MarracashSelection,
    end: QueueEnd
): MarracashSelection {
    const next = setMarracashSelection(selection, 'queueEnd', end)
    const count = selection.visitorCount
    return count === undefined
        ? next
        : setStagedSelectionValue<MarracashSelectionValues, 'visitorCount'>(
              next,
              MarracashStageOrder,
              'visitorCount',
              count.value,
              count.source
          )
}

export function setMarracashRefill(
    selection: MarracashSelection,
    end: QueueEnd,
    count: number
): MarracashSelection {
    return setMarracashSelection(
        setMarracashSelection(selection, 'queueEnd', end),
        'visitorCount',
        count
    )
}

export function hasManualMarracashSelection(selection: MarracashSelection): boolean {
    return hasManualStagedSelection<MarracashSelectionValues>(selection, MarracashStageOrder)
}

export function popMarracashSelection(selection: MarracashSelection): MarracashSelection {
    return popHighestManualStagedSelection<MarracashSelectionValues>(selection, MarracashStageOrder)
        .nextState
}
