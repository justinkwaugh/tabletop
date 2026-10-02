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
    shop: ShopId
    queueEnd: QueueEnd
    visitorCount: number
}

export type MarracashSelection = StagedSelectionState<MarracashSelectionValues>

const STAGE_ORDER = [
    'fountain',
    'shop',
    'queueEnd',
    'visitorCount'
] as const satisfies readonly (keyof MarracashSelectionValues)[]
type MissingStages = Exclude<keyof MarracashSelectionValues, (typeof STAGE_ORDER)[number]>
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
              STAGE_ORDER,
              stage
          )
        : setStagedSelectionValue<MarracashSelectionValues, TStage>(
              selection,
              STAGE_ORDER,
              stage,
              value,
              'manual'
          )
}

export function hasManualMarracashSelection(selection: MarracashSelection): boolean {
    return hasManualStagedSelection<MarracashSelectionValues>(selection, STAGE_ORDER)
}

export function popMarracashSelection(selection: MarracashSelection): MarracashSelection {
    return popHighestManualStagedSelection<MarracashSelectionValues>(selection, STAGE_ORDER)
        .nextState
}
