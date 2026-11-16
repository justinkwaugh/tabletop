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

/**
 * How many of the route's links a press on `cityId` keeps: none on the start, up to and including
 * the link that reaches it on a city the route reaches, `undefined` on a city off the route.
 */
export function linksKeptAt(
    startCityId: CityId,
    links: readonly DraftLink[],
    cityId: CityId
): number | undefined {
    if (cityId === startCityId) return 0
    const reached = links.findIndex((link) => link.cityId === cityId)
    return reached < 0 ? undefined : reached + 1
}

/** The route cut back to its first `count` links, as one press Undo takes back. */
export function cutDraftLinks(stage: JourneyStage, count: number): JourneyStage {
    return pushStagedSelectionValue<JourneyStageValues, 'links'>(
        stage,
        JourneyStageOrder,
        'links',
        draftLinks(stage).slice(0, count)
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
