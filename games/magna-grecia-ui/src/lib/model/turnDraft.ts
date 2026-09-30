import type { AxialCoordinates } from '@tabletop/common'
import {
    clearStagedSelectionAtOrAfter,
    getStagedSelectionValue,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { RoadShape } from '@tabletop/magna-grecia'

export type RoadLayValues = {
    space: AxialCoordinates
    shape: RoadShape
}

export type RoadLaySelection = StagedSelectionState<RoadLayValues>

const STAGE_ORDER = ['space', 'shape'] as const satisfies readonly (keyof RoadLayValues)[]
type MissingStages = Exclude<keyof RoadLayValues, (typeof STAGE_ORDER)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export type TurnDraft = {
    road: RoadLaySelection
    rotation: number
    resupplyOpen: boolean
}

export function emptyDraft(): TurnDraft {
    return { road: {}, rotation: 0, resupplyOpen: false }
}

export function draftRoadSpace(draft: TurnDraft): AxialCoordinates | undefined {
    return getStagedSelectionValue<RoadLayValues, 'space'>(draft.road, 'space')
}

export function draftRoadShape(draft: TurnDraft): RoadShape | undefined {
    return getStagedSelectionValue<RoadLayValues, 'shape'>(draft.road, 'shape')
}

export function chooseRoadSpace(draft: TurnDraft, space: AxialCoordinates): TurnDraft {
    return {
        road: setStagedSelectionValue(draft.road, STAGE_ORDER, 'space', space, 'manual'),
        rotation: 0,
        resupplyOpen: false
    }
}

export function chooseRoadShape(draft: TurnDraft, shape: RoadShape): TurnDraft {
    if (!draftRoadSpace(draft)) {
        throw new Error('A road shape needs a road space first')
    }
    return {
        ...draft,
        road: setStagedSelectionValue(draft.road, STAGE_ORDER, 'shape', shape, 'manual'),
        rotation: 0
    }
}

export function rotateRoad(draft: TurnDraft, placements: number): TurnDraft {
    if (placements < 2) {
        return draft
    }
    return { ...draft, rotation: (draft.rotation + 1) % placements }
}

export function toggleResupply(draft: TurnDraft): TurnDraft {
    if (draft.resupplyOpen) {
        return { ...draft, resupplyOpen: false }
    }
    return { ...emptyDraft(), resupplyOpen: true }
}

export function hasManualDraft(draft: TurnDraft): boolean {
    return draft.resupplyOpen || hasManualStagedSelection(draft.road, STAGE_ORDER)
}

export function backDraft(draft: TurnDraft): TurnDraft {
    if (draft.resupplyOpen) {
        return { ...draft, resupplyOpen: false }
    }
    const { nextState, poppedStage } = popHighestManualStagedSelection(draft.road, STAGE_ORDER)
    return poppedStage ? { ...draft, road: nextState, rotation: 0 } : draft
}

export function clearRoadLay(draft: TurnDraft): TurnDraft {
    return {
        ...draft,
        road: clearStagedSelectionAtOrAfter(draft.road, STAGE_ORDER, 'space'),
        rotation: 0
    }
}
