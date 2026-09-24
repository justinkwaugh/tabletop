import {
    setStagedSelectionValue,
    popHighestManualStagedSelection,
    hasManualStagedSelection,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { BranchSplitRequest, BranchSplitAllocation } from '@tabletop/the-old-prince'

type SplitStages = {
    action: true
    parentId: string
    branchId: string
    marketSpaceId: string
    allocation: BranchSplitAllocation
}
const Stages = [
    'action',
    'parentId',
    'branchId',
    'marketSpaceId',
    'allocation'
] as const satisfies readonly (keyof SplitStages)[]
const CompleteStages: Exclude<keyof SplitStages, (typeof Stages)[number]> extends never
    ? true
    : never = true
export type BranchSplitSelection = StagedSelectionState<SplitStages>
export function chooseSplitAction(): BranchSplitSelection {
    return setStagedSelectionValue<SplitStages, 'action'>({}, Stages, 'action', true, 'manual')
}
export function chooseSplitParent(
    selection: BranchSplitSelection,
    parentId: string
): BranchSplitSelection {
    return setStagedSelectionValue(selection, Stages, 'parentId', parentId, 'manual')
}
export function chooseSplitBranch(
    selection: BranchSplitSelection,
    branchId: string
): BranchSplitSelection {
    return setStagedSelectionValue(selection, Stages, 'branchId', branchId, 'manual')
}
export function chooseSplitPrice(
    selection: BranchSplitSelection,
    marketSpaceId: string
): BranchSplitSelection {
    return initializeSplitAllocation(
        setStagedSelectionValue(selection, Stages, 'marketSpaceId', marketSpaceId, 'manual')
    )
}
export function backSplitSelection(selection: BranchSplitSelection): BranchSplitSelection {
    const next = popHighestManualStagedSelection<SplitStages>(selection, Stages).nextState
    return next.marketSpaceId && !next.allocation ? initializeSplitAllocation(next) : next
}
export function hasSplitSelection(selection: BranchSplitSelection): boolean {
    return CompleteStages && hasManualStagedSelection(selection, Stages)
}
export function splitRequest(
    selection: BranchSplitSelection,
    playerId: string
): BranchSplitRequest | undefined {
    return selection.parentId && selection.branchId && selection.marketSpaceId
        ? {
              playerId,
              parentId: selection.parentId.value,
              branchId: selection.branchId.value,
              marketSpaceId: selection.marketSpaceId.value
          }
        : undefined
}

export function chooseSplitAllocation(
    selection: BranchSplitSelection,
    allocation: BranchSplitAllocation
): BranchSplitSelection {
    return setStagedSelectionValue(selection, Stages, 'allocation', allocation, 'manual')
}

function initializeSplitAllocation(selection: BranchSplitSelection): BranchSplitSelection {
    return setStagedSelectionValue(
        selection,
        Stages,
        'allocation',
        {
            stationIds: [],
            homeStationId: '',
            trainIds: [],
            cash: 0,
            hunslet: false
        },
        'auto'
    )
}
