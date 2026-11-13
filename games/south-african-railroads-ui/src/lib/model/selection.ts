import { setStagedSelectionValue, type StagedSelectionState } from '@tabletop/frontend-components'
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

// Developing settlements: a settlement that may be developed or left, whose picker asks which.
export type SettlementSelectionValues = {
    settlement: string
}

export type SettlementSelection = StagedSelectionState<SettlementSelectionValues>

export const SettlementStageOrder = [
    'settlement'
] as const satisfies readonly (keyof SettlementSelectionValues)[]

export function selectSettlement(selection: SettlementSelection, settlementId: string) {
    return setStagedSelectionValue<SettlementSelectionValues, 'settlement'>(
        selection,
        SettlementStageOrder,
        'settlement',
        settlementId,
        'manual'
    )
}
