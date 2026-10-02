import type { AxialCoordinates } from '@tabletop/common'
import {
    clearStagedSelectionAtOrAfter,
    getStagedSelectionEntry,
    getStagedSelectionValue,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { RoadShape } from '@tabletop/magna-grecia'
import type { BuildTool } from './buildTool.js'

export type ToolChoice = {
    tool: BuildTool
    turnKey: string
}

export type TurnDraftValues = {
    tool: ToolChoice
    space: AxialCoordinates
    shape: RoadShape
}

export type TurnDraftSelection = StagedSelectionState<TurnDraftValues>

const STAGE_ORDER = ['tool', 'space', 'shape'] as const satisfies readonly (keyof TurnDraftValues)[]
type MissingStages = Exclude<keyof TurnDraftValues, (typeof STAGE_ORDER)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export type TurnDraft = {
    selection: TurnDraftSelection
    rotation: number
    resupplyOpen: boolean
}

export function emptyDraft(): TurnDraft {
    return { selection: {}, rotation: 0, resupplyOpen: false }
}

export function draftTool(draft: TurnDraft): ToolChoice | undefined {
    return getStagedSelectionValue<TurnDraftValues, 'tool'>(draft.selection, 'tool')
}

export function draftRoadSpace(draft: TurnDraft): AxialCoordinates | undefined {
    return getStagedSelectionValue<TurnDraftValues, 'space'>(draft.selection, 'space')
}

export function draftRoadShape(draft: TurnDraft): RoadShape | undefined {
    return getStagedSelectionValue<TurnDraftValues, 'shape'>(draft.selection, 'shape')
}

export function chooseTool(draft: TurnDraft, tool: BuildTool, turnKey: string): TurnDraft {
    return {
        selection: setStagedSelectionValue(
            draft.selection,
            STAGE_ORDER,
            'tool',
            { tool, turnKey },
            'manual'
        ),
        rotation: 0,
        resupplyOpen: false
    }
}

// A tool chosen this turn stays selected across the turn's own actions, but only as an
// automatic selection, so Undo after an action undoes that action rather than the choice.
export function carryTool(draft: TurnDraft, turnKey: string): TurnDraft {
    const entry = getStagedSelectionEntry<TurnDraftValues, 'tool'>(draft.selection, 'tool')
    if (!entry || entry.value.turnKey !== turnKey) {
        return emptyDraft()
    }
    return {
        ...emptyDraft(),
        selection: setStagedSelectionValue({}, STAGE_ORDER, 'tool', entry.value, 'auto')
    }
}

export function chooseRoadSpace(draft: TurnDraft, space: AxialCoordinates): TurnDraft {
    return {
        selection: setStagedSelectionValue(draft.selection, STAGE_ORDER, 'space', space, 'manual'),
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
        selection: setStagedSelectionValue(draft.selection, STAGE_ORDER, 'shape', shape, 'manual'),
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
        return closeResupply(draft)
    }
    return { ...clearRoadLay(draft), resupplyOpen: true }
}

export function closeResupply(draft: TurnDraft): TurnDraft {
    return { ...draft, resupplyOpen: false }
}

export function hasManualDraft(draft: TurnDraft): boolean {
    return draft.resupplyOpen || hasManualStagedSelection(draft.selection, STAGE_ORDER)
}

export function backDraft(draft: TurnDraft): TurnDraft {
    if (draft.resupplyOpen) {
        return closeResupply(draft)
    }
    const { nextState, poppedStage } = popHighestManualStagedSelection(draft.selection, STAGE_ORDER)
    return poppedStage ? { ...draft, selection: nextState, rotation: 0 } : draft
}

export function clearRoadLay(draft: TurnDraft): TurnDraft {
    return {
        ...draft,
        selection: clearStagedSelectionAtOrAfter(draft.selection, STAGE_ORDER, 'space'),
        rotation: 0
    }
}
