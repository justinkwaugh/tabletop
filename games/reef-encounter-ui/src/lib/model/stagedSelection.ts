import type { AlgaColor, CoralColor, ReefSquare } from '@tabletop/reef-encounter'
import {
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type ShrimpIntent = { kind: 'introduce' } | { kind: 'move'; from: ReefSquare }

export type PolypSource = 'supply' | 'consumed'

export type ReefSelectionValues = {
    firstLarvaCube: CoralColor
    placementSquare: ReefSquare
    shrimp: ShrimpIntent
    cylinderPayment: CoralColor
    cylinderAlga: AlgaColor
    eating: true
}

export type ReefSelection = StagedSelectionState<ReefSelectionValues>

export const ReefStageOrder = [
    'firstLarvaCube',
    'placementSquare',
    'shrimp',
    'cylinderPayment',
    'cylinderAlga',
    'eating'
] as const satisfies readonly (keyof ReefSelectionValues)[]
type MissingStages = Exclude<keyof ReefSelectionValues, (typeof ReefStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

function setReefSelection<TStage extends keyof ReefSelectionValues>(
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

export function chooseFirstLarvaCube(selection: ReefSelection, color: CoralColor) {
    return setReefSelection(selection, 'firstLarvaCube', color)
}

export function choosePlacementSquare(selection: ReefSelection, square: ReefSquare) {
    return setReefSelection(selection, 'placementSquare', square)
}

export function chooseShrimp(selection: ReefSelection, intent: ShrimpIntent) {
    return setReefSelection(selection, 'shrimp', intent)
}

export function chooseCylinderPayment(selection: ReefSelection, color: CoralColor) {
    return setReefSelection(selection, 'cylinderPayment', color)
}

export function chooseCylinderAlga(selection: ReefSelection, alga: AlgaColor) {
    return setReefSelection(selection, 'cylinderAlga', alga)
}

export function startEating(selection: ReefSelection) {
    return setReefSelection(selection, 'eating', true)
}

export function hasManualReefSelection(selection: ReefSelection): boolean {
    return hasManualStagedSelection<ReefSelectionValues>(selection, ReefStageOrder)
}

export function popReefSelection(selection: ReefSelection): ReefSelection {
    return popHighestManualStagedSelection<ReefSelectionValues>(selection, ReefStageOrder).nextState
}
