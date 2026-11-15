import {
    clearStagedSelectionAtOrAfter,
    getStagedSelectionValue,
    pushStagedSelectionValue,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { CityId, RailroadId } from '@tabletop/ride-the-rails'

// R-3.3.2: one link of the route, named by the city it reaches and the railroad that makes it.
export type DraftLink = {
    cityId: CityId
    railroadId: RailroadId
}

export type JourneyStageValues = {
    start: CityId
    links: DraftLink[]
    railroadChoice: CityId
}

export type JourneyStage = StagedSelectionState<JourneyStageValues>

export const JourneyStageOrder = [
    'start',
    'links',
    'railroadChoice'
] as const satisfies readonly (keyof JourneyStageValues)[]
type MissingStages = Exclude<keyof JourneyStageValues, (typeof JourneyStageOrder)[number]>
const coverage: MissingStages extends never ? true : never = true
void coverage

export function pickJourneyStart(stage: JourneyStage, cityId: CityId): JourneyStage {
    return setStagedSelectionValue<JourneyStageValues, 'start'>(
        stage,
        JourneyStageOrder,
        'start',
        cityId,
        'manual'
    )
}

export function pushDraftLink(stage: JourneyStage, link: DraftLink): JourneyStage {
    return pushStagedSelectionValue<JourneyStageValues, 'links'>(
        stage,
        JourneyStageOrder,
        'links',
        [...draftLinks(stage), link]
    )
}

export function openRailroadChoice(stage: JourneyStage, cityId: CityId): JourneyStage {
    return setStagedSelectionValue<JourneyStageValues, 'railroadChoice'>(
        stage,
        JourneyStageOrder,
        'railroadChoice',
        cityId,
        'manual'
    )
}

export function closeRailroadChoice(stage: JourneyStage): JourneyStage {
    return clearStagedSelectionAtOrAfter<JourneyStageValues, 'railroadChoice'>(
        stage,
        JourneyStageOrder,
        'railroadChoice'
    )
}

export function journeyStart(stage: JourneyStage): CityId | undefined {
    return getStagedSelectionValue<JourneyStageValues, 'start'>(stage, 'start')
}

export function draftLinks(stage: JourneyStage): DraftLink[] {
    return getStagedSelectionValue<JourneyStageValues, 'links'>(stage, 'links') ?? []
}

export function railroadChoiceCity(stage: JourneyStage): CityId | undefined {
    return getStagedSelectionValue<JourneyStageValues, 'railroadChoice'>(stage, 'railroadChoice')
}
