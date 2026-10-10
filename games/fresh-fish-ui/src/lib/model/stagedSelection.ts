import { ActionType } from '@tabletop/fresh-fish'
import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type FreshFishSelectionValues = {
    action: ActionType
}

export type FreshFishSelection = StagedSelectionState<FreshFishSelectionValues>

export const FreshFishStageOrder = [
    'action'
] as const satisfies readonly (keyof FreshFishSelectionValues)[]
type MissingStages = Exclude<keyof FreshFishSelectionValues, (typeof FreshFishStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setFreshFishSelection<TStage extends keyof FreshFishSelectionValues>(
    selection: FreshFishSelection,
    stage: TStage,
    value: FreshFishSelectionValues[TStage] | undefined
): FreshFishSelection {
    return value === undefined
        ? clearStagedSelectionAtOrAfter<FreshFishSelectionValues, TStage>(
              selection,
              FreshFishStageOrder,
              stage
          )
        : setStagedSelectionValue<FreshFishSelectionValues, TStage>(
              selection,
              FreshFishStageOrder,
              stage,
              value,
              'manual'
          )
}

export function hasManualFreshFishSelection(selection: FreshFishSelection): boolean {
    return hasManualStagedSelection<FreshFishSelectionValues>(selection, FreshFishStageOrder)
}

export function popFreshFishSelection(selection: FreshFishSelection): FreshFishSelection {
    return popHighestManualStagedSelection<FreshFishSelectionValues>(selection, FreshFishStageOrder)
        .nextState
}

const ACTION_TYPES: readonly string[] = Object.values(ActionType)

export function isActionType(value: string): value is ActionType {
    return ACTION_TYPES.includes(value)
}
