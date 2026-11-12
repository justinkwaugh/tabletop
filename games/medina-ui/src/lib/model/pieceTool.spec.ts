import { PalaceColor } from '@tabletop/medina'
import {
    hasManualStagedSelection,
    popHighestManualStagedSelection
} from '@tabletop/frontend-components'
import { describe, expect, it } from 'vitest'
import { ToolStageOrder, carryTool, chooseTool, chosenTool, sameTool } from './pieceTool.js'

const orange = { kind: 'building', color: PalaceColor.Orange } as const
const grey = { kind: 'building', color: PalaceColor.Grey } as const

describe('the piece tool', () => {
    it('makes a chosen tool the one Undo takes back', () => {
        const selection = chooseTool({}, { tool: orange, turn: 3 })
        expect(chosenTool(selection)?.tool).toEqual(orange)
        expect(hasManualStagedSelection(selection, ToolStageOrder)).toBe(true)
        const { nextState, poppedStage } = popHighestManualStagedSelection(
            selection,
            ToolStageOrder
        )
        expect(poppedStage).toBe('tool')
        expect(chosenTool(nextState)).toBeUndefined()
    })

    it('lets Undo pass a carried tool on to the placement before it', () => {
        const selection = carryTool({}, { tool: orange, turn: 3 })
        expect(chosenTool(selection)?.tool).toEqual(orange)
        expect(hasManualStagedSelection(selection, ToolStageOrder)).toBe(false)
    })

    it('tells tools apart by colour', () => {
        expect(sameTool(orange, orange)).toBe(true)
        expect(sameTool(orange, grey)).toBe(false)
        expect(sameTool(orange, { kind: 'stable' })).toBe(false)
        expect(sameTool(undefined, orange)).toBe(false)
    })
})
