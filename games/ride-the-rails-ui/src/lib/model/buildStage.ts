import {
    clearStagedSelectionAtOrAfter,
    getStagedSelectionValue,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { HexId } from '@tabletop/ride-the-rails'

export type BuildStageValues = {
    hex: HexId
}

export type BuildStage = StagedSelectionState<BuildStageValues>

export const BuildStageOrder = ['hex'] as const satisfies readonly (keyof BuildStageValues)[]
type MissingStages = Exclude<keyof BuildStageValues, (typeof BuildStageOrder)[number]>
const coverage: MissingStages extends never ? true : never = true
void coverage

export function pickBuildHex(stage: BuildStage, hexId: HexId): BuildStage {
    return setStagedSelectionValue<BuildStageValues, 'hex'>(
        stage,
        BuildStageOrder,
        'hex',
        hexId,
        'manual'
    )
}

export function unpickBuildHex(stage: BuildStage): BuildStage {
    return clearStagedSelectionAtOrAfter<BuildStageValues, 'hex'>(stage, BuildStageOrder, 'hex')
}

export function pickedBuildHex(stage: BuildStage): HexId | undefined {
    return getStagedSelectionValue<BuildStageValues, 'hex'>(stage, 'hex')
}
