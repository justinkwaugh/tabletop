import {
    getStagedSelectionValue,
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
type DeliverySelectionStage = (typeof DELIVERY_SELECTION_STAGE_ORDER)[number]

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
    return hasManualStagedSelection<DeliverySelectionValueByStage>(
        state,
        DELIVERY_SELECTION_STAGE_ORDER
    )
}

export function popHighestManualDeliverySelection(
    state: StagedSelectionState<DeliverySelectionValueByStage>
): {
    nextState: StagedSelectionState<DeliverySelectionValueByStage>
    poppedStage?: DeliverySelectionStage
} {
    return popHighestManualStagedSelection<DeliverySelectionValueByStage>(
        state,
        DELIVERY_SELECTION_STAGE_ORDER
    )
}

export function getDeliverySelectionValue<TStage extends DeliverySelectionStage>(
    state: StagedSelectionState<DeliverySelectionValueByStage>,
    stage: TStage
): DeliverySelectionValueByStage[TStage] | undefined {
    return getStagedSelectionValue<DeliverySelectionValueByStage, TStage>(state, stage)
}

export function setDeliveryCultivatedSelection(
    state: StagedSelectionState<DeliverySelectionValueByStage>,
    areaId: string,
    source: StagedSelectionSource
): StagedSelectionState<DeliverySelectionValueByStage> {
    return setStagedSelectionValue<DeliverySelectionValueByStage, 'cultivated'>(
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
    return setStagedSelectionValue<DeliverySelectionValueByStage, 'city'>(
        state,
        DELIVERY_SELECTION_STAGE_ORDER,
        'city',
        cityId,
        'manual'
    )
}
