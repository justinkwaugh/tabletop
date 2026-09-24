import type { StationRequest } from '@tabletop/18xx'
import type { StagedSelectionState } from '@tabletop/frontend-components'

export type StationStages = { stationId: string; placement: StationRequest }
export const StationStageOrder = [
    'stationId',
    'placement'
] as const satisfies readonly (keyof StationStages)[]
export type StationSelection = StagedSelectionState<StationStages>

export function automaticStation(stationId: string): StationSelection {
    return { stationId: { value: stationId, source: 'auto' } }
}
