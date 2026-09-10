import {
    setStagedSelectionValue,
    popHighestManualStagedSelection,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { StationRequest } from '@tabletop/18xx'
type Stages = { stationId: string; placement: StationRequest }
const Order = ['stationId', 'placement'] as const
export type StationSelection = StagedSelectionState<Stages>
export function chooseStation(stationId: string): StationSelection {
    return setStagedSelectionValue<Stages, 'stationId'>({}, Order, 'stationId', stationId, 'manual')
}
export function chooseStationPosition(
    selection: StationSelection,
    placement: StationRequest
): StationSelection {
    return setStagedSelectionValue(selection, Order, 'placement', placement, 'manual')
}
export function backFromStation(selection: StationSelection): StationSelection {
    return popHighestManualStagedSelection(selection, Order).nextState
}
