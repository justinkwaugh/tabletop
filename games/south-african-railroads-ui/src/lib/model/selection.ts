import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { RailroadId } from '@tabletop/south-african-railroads'

// Building track: which railroad builds (or is handed to its controller), then the first link
// of what may become a double build.
export type BuildSelectionValues = {
    railroad: RailroadId
    firstLink: string
}

export type BuildSelection = StagedSelectionState<BuildSelectionValues>

export const BuildStageOrder = [
    'railroad',
    'firstLink'
] as const satisfies readonly (keyof BuildSelectionValues)[]
type MissingStages = Exclude<keyof BuildSelectionValues, (typeof BuildStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function selectBuildRailroad(selection: BuildSelection, railroadId: RailroadId) {
    return setStagedSelectionValue<BuildSelectionValues, 'railroad'>(
        selection,
        BuildStageOrder,
        'railroad',
        railroadId,
        'manual'
    )
}

export function selectFirstLink(selection: BuildSelection, linkId: string) {
    return setStagedSelectionValue<BuildSelectionValues, 'firstLink'>(
        selection,
        BuildStageOrder,
        'firstLink',
        linkId,
        'manual'
    )
}

export function clearFirstLink(selection: BuildSelection): BuildSelection {
    return clearStagedSelectionAtOrAfter<BuildSelectionValues, 'firstLink'>(
        selection,
        BuildStageOrder,
        'firstLink'
    )
}

export function hasManualBuildSelection(selection: BuildSelection): boolean {
    return hasManualStagedSelection<BuildSelectionValues>(selection, BuildStageOrder)
}

export function popBuildSelection(selection: BuildSelection): BuildSelection {
    return popHighestManualStagedSelection<BuildSelectionValues>(selection, BuildStageOrder)
        .nextState
}
