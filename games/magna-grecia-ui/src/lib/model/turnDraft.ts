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
import { BuildTool } from './buildTool.js'

export type ToolChoice = {
    tool: BuildTool
    turnKey: string
}

export type TurnDraftValues = {
    tilesSkipped: true
    tool: ToolChoice
    resupply: true
    space: AxialCoordinates
    shape: RoadShape
    endTurn: true
}

export type TurnDraftSelection = StagedSelectionState<TurnDraftValues>

const STAGE_ORDER = [
    'tilesSkipped',
    'tool',
    'resupply',
    'space',
    'shape',
    'endTurn'
] as const satisfies readonly (keyof TurnDraftValues)[]
type MissingStages = Exclude<keyof TurnDraftValues, (typeof STAGE_ORDER)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export type TurnDraft = {
    selection: TurnDraftSelection
    rotation: number
}

export function emptyDraft(): TurnDraft {
    return { selection: {}, rotation: 0 }
}

export function draftResupplyOpen(draft: TurnDraft): boolean {
    return (
        getStagedSelectionValue<TurnDraftValues, 'resupply'>(draft.selection, 'resupply') === true
    )
}

export function draftTool(draft: TurnDraft): ToolChoice | undefined {
    return getStagedSelectionValue<TurnDraftValues, 'tool'>(draft.selection, 'tool')
}

export function draftTilesSkipped(draft: TurnDraft): boolean {
    return (
        getStagedSelectionValue<TurnDraftValues, 'tilesSkipped'>(
            draft.selection,
            'tilesSkipped'
        ) === true
    )
}

export function skipTiles(draft: TurnDraft): TurnDraft {
    return {
        selection: setStagedSelectionValue(
            draft.selection,
            STAGE_ORDER,
            'tilesSkipped',
            true,
            'manual'
        ),
        rotation: 0
    }
}

export function draftRoadSpace(draft: TurnDraft): AxialCoordinates | undefined {
    return getStagedSelectionValue<TurnDraftValues, 'space'>(draft.selection, 'space')
}

export function draftRoadShape(draft: TurnDraft): RoadShape | undefined {
    return getStagedSelectionValue<TurnDraftValues, 'shape'>(draft.selection, 'shape')
}

export function chooseTool(draft: TurnDraft, tool: BuildTool, turnKey: string): TurnDraft {
    const isTileTool = tool === BuildTool.Road || tool === BuildTool.City
    const base = isTileTool
        ? clearStagedSelectionAtOrAfter(draft.selection, STAGE_ORDER, 'tilesSkipped')
        : draft.selection
    return {
        selection: setStagedSelectionValue(base, STAGE_ORDER, 'tool', { tool, turnKey }, 'manual'),
        rotation: 0
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
    const base = clearStagedSelectionAtOrAfter(draft.selection, STAGE_ORDER, 'resupply')
    return {
        selection: setStagedSelectionValue(base, STAGE_ORDER, 'space', space, 'manual'),
        rotation: 0
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
    if (draftResupplyOpen(draft)) {
        return closeResupply(draft)
    }
    return {
        selection: setStagedSelectionValue(
            draft.selection,
            STAGE_ORDER,
            'resupply',
            true,
            'manual'
        ),
        rotation: 0
    }
}

export function closeResupply(draft: TurnDraft): TurnDraft {
    return {
        ...draft,
        selection: clearStagedSelectionAtOrAfter(draft.selection, STAGE_ORDER, 'resupply')
    }
}

export function draftConfirmingEndTurn(draft: TurnDraft): boolean {
    return getStagedSelectionValue<TurnDraftValues, 'endTurn'>(draft.selection, 'endTurn') === true
}

// Asking to confirm End turn closes any picker or road being laid but keeps the chosen tool.
export function askToConfirmEndTurn(draft: TurnDraft): TurnDraft {
    const base = clearStagedSelectionAtOrAfter(draft.selection, STAGE_ORDER, 'resupply')
    return {
        selection: setStagedSelectionValue(base, STAGE_ORDER, 'endTurn', true, 'manual'),
        rotation: 0
    }
}

export function dropEndTurnConfirm(draft: TurnDraft): TurnDraft {
    return {
        ...draft,
        selection: clearStagedSelectionAtOrAfter(draft.selection, STAGE_ORDER, 'endTurn')
    }
}

export function hasManualDraft(draft: TurnDraft): boolean {
    return hasManualStagedSelection(draft.selection, STAGE_ORDER)
}

// Undo unwinds the newest manual stage; automatic stages are left for the action undo.
export function undoDraft(draft: TurnDraft): TurnDraft {
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
