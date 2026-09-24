import type { StagedSelectionState } from '@tabletop/frontend-components'
import type { TrackRequest } from '@tabletop/18xx'

export type TrackStages = { locationId: string; definitionId: string; placement: TrackRequest }
export const TrackStageOrder = ['locationId', 'definitionId', 'placement'] as const
export type TrackSelection = StagedSelectionState<TrackStages>
