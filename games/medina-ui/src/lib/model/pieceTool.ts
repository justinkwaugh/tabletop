import { PalaceColor } from '@tabletop/medina'
import {
    getStagedSelectionValue,
    setStagedSelectionValue,
    type StagedSelectionState
} from '@tabletop/frontend-components'

export type PieceTool =
    | { kind: 'building'; color: PalaceColor }
    | { kind: 'rooftop' }
    | { kind: 'neutralRooftop' }
    | { kind: 'stable' }
    | { kind: 'merchant' }
    | { kind: 'wall' }

export type ChosenTool = { tool: PieceTool; turn: number }

export type ToolSelectionValues = { tool: ChosenTool }

export type ToolSelection = StagedSelectionState<ToolSelectionValues>

export const ToolStageOrder = ['tool'] as const satisfies readonly (keyof ToolSelectionValues)[]

export function chosenTool(selection: ToolSelection): ChosenTool | undefined {
    return getStagedSelectionValue<ToolSelectionValues, 'tool'>(selection, 'tool')
}

export function chooseTool(selection: ToolSelection, chosen: ChosenTool): ToolSelection {
    return setStagedSelectionValue(selection, ToolStageOrder, 'tool', chosen, 'manual')
}

export function carryTool(selection: ToolSelection, chosen: ChosenTool): ToolSelection {
    return setStagedSelectionValue(selection, ToolStageOrder, 'tool', chosen, 'auto')
}

export function sameTool(a: PieceTool | undefined, b: PieceTool | undefined): boolean {
    if (!a || !b || a.kind !== b.kind) {
        return false
    }
    return a.kind !== 'building' || b.kind !== 'building' || a.color === b.color
}
