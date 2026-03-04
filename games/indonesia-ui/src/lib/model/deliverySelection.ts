import {
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionSource,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type DeliverySelectionValueByStage = {
    cultivated: string
    city: string
}

export const DELIVERY_SELECTION_STAGE_ORDER = [
    'cultivated',
    'city'
] as const satisfies readonly (keyof DeliverySelectionValueByStage)[]

type MissingDeliverySelectionStages = Exclude<
    keyof DeliverySelectionValueByStage,
    (typeof DELIVERY_SELECTION_STAGE_ORDER)[number]
>
const _assertDeliverySelectionStageCoverage: MissingDeliverySelectionStages extends never
    ? true
    : never = true
void _assertDeliverySelectionStageCoverage

export function hasManualDeliverySelection(
    state: StagedSelectionState<DeliverySelectionValueByStage>
): boolean {
    return hasManualStagedSelection(state, DELIVERY_SELECTION_STAGE_ORDER)
}

export function popHighestManualDeliverySelection(
    state: StagedSelectionState<DeliverySelectionValueByStage>
): {
    nextState: StagedSelectionState<DeliverySelectionValueByStage>
    poppedStage?: (typeof DELIVERY_SELECTION_STAGE_ORDER)[number]
} {
    return popHighestManualStagedSelection(state, DELIVERY_SELECTION_STAGE_ORDER)
}

export function setDeliveryCultivatedSelection(
    state: StagedSelectionState<DeliverySelectionValueByStage>,
    areaId: string,
    source: StagedSelectionSource
): StagedSelectionState<DeliverySelectionValueByStage> {
    return setStagedSelectionValue(
        state,
        DELIVERY_SELECTION_STAGE_ORDER,
        'cultivated',
        areaId,
        source
    )
}

export function setDeliveryCitySelection(
    state: StagedSelectionState<DeliverySelectionValueByStage>,
    cityId: string
): StagedSelectionState<DeliverySelectionValueByStage> {
    return setStagedSelectionValue(state, DELIVERY_SELECTION_STAGE_ORDER, 'city', cityId, 'manual')
}
