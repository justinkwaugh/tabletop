import type { AlgaColor, CoralColor, ReefSquare } from '@tabletop/reef-encounter'
import {
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type ShrimpIntent = { kind: 'introduce' } | { kind: 'move'; from: ReefSquare }

export type ReefSelectionValues = {
    firstLarvaCube: CoralColor
    shrimp: ShrimpIntent
    cylinderPayment: CoralColor
    cylinderAlga: AlgaColor
    eating: true
}

export type ReefSelection = StagedSelectionState<ReefSelectionValues>

export const ReefStageOrder = [
    'firstLarvaCube',
    'shrimp',
    'cylinderPayment',
    'cylinderAlga',
    'eating'
] as const satisfies readonly (keyof ReefSelectionValues)[]
type MissingStages = Exclude<keyof ReefSelectionValues, (typeof ReefStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function setReefSelection<TStage extends keyof ReefSelectionValues>(
    selection: ReefSelection,
    stage: TStage,
    value: ReefSelectionValues[TStage]
): ReefSelection {
    return setStagedSelectionValue<ReefSelectionValues, TStage>(
        selection,
        ReefStageOrder,
        stage,
        value,
        'manual'
    )
}

export function hasManualReefSelection(selection: ReefSelection): boolean {
    return hasManualStagedSelection<ReefSelectionValues>(selection, ReefStageOrder)
}

export function popReefSelection(selection: ReefSelection): ReefSelection {
    return popHighestManualStagedSelection<ReefSelectionValues>(selection, ReefStageOrder).nextState
}
