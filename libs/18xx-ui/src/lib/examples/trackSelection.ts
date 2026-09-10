import {
    setStagedSelectionValue,
    popHighestManualStagedSelection,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { TrackRequest } from '@tabletop/18xx'

type TrackStages = { locationId: string; definitionId: string; placement: TrackRequest }
const Stages = [
    'locationId',
    'definitionId',
    'placement'
] as const satisfies readonly (keyof TrackStages)[]
export type TrackSelection = StagedSelectionState<TrackStages>
export function chooseTrackLocation(locationId: string): TrackSelection {
    return setStagedSelectionValue<TrackStages, 'locationId'>(
        {},
        Stages,
        'locationId',
        locationId,
        'manual'
    )
}
export function chooseTrackTile(
    selection: TrackSelection,
    definitionId: string,
    choices: readonly TrackRequest[]
): TrackSelection {
    const next = setStagedSelectionValue(selection, Stages, 'definitionId', definitionId, 'manual')
    return choices.length === 1
        ? setStagedSelectionValue(next, Stages, 'placement', choices[0], 'auto')
        : next
}
export function chooseTrackPlacement(
    selection: TrackSelection,
    request: TrackRequest
): TrackSelection {
    return setStagedSelectionValue(selection, Stages, 'placement', request, 'manual')
}
export function backFromTrack(selection: TrackSelection): TrackSelection {
    return popHighestManualStagedSelection(selection, Stages).nextState
}
