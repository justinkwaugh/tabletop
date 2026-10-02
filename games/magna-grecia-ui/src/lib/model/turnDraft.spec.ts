import { describe, expect, it } from 'vitest'
import { RoadShape, offsetToAxial } from '@tabletop/magna-grecia'
import { BuildTool } from './buildTool.js'
import {
    askToConfirmEndTurn,
    carryTool,
    chooseRoadShape,
    chooseRoadSpace,
    chooseTool,
    clearRoadLay,
    closeResupply,
    draftConfirmingEndTurn,
    draftResupplyOpen,
    draftRoadShape,
    draftRoadSpace,
    draftTilesSkipped,
    draftTool,
    dropEndTurnConfirm,
    emptyDraft,
    hasManualDraft,
    rotateRoad,
    skipTiles,
    toggleResupply,
    undoDraft
} from './turnDraft.js'

const first = offsetToAxial({ row: 3, col: 3 })
const second = offsetToAxial({ row: 5, col: 4 })

describe('turn draft', () => {
    it('clears the shape and rotation when an earlier stage is set again', () => {
        let draft = chooseRoadShape(chooseRoadSpace(emptyDraft(), first), RoadShape.Curve)
        draft = rotateRoad(draft, 3)
        expect(draft.rotation).toBe(1)

        draft = chooseRoadSpace(draft, second)
        expect(draftRoadSpace(draft)).toEqual(second)
        expect(draftRoadShape(draft)).toBeUndefined()
        expect(draft.rotation).toBe(0)
    })

    it('resets the rotation when a new shape is chosen', () => {
        let draft = chooseRoadShape(chooseRoadSpace(emptyDraft(), first), RoadShape.Curve)
        draft = rotateRoad(rotateRoad(draft, 3), 3)
        draft = chooseRoadShape(draft, RoadShape.Straight)
        expect(draftRoadShape(draft)).toBe(RoadShape.Straight)
        expect(draft.rotation).toBe(0)
    })

    it('Undo pops the highest manual stage first', () => {
        let draft = chooseRoadShape(chooseRoadSpace(emptyDraft(), first), RoadShape.Curve)
        draft = undoDraft(draft)
        expect(draftRoadShape(draft)).toBeUndefined()
        expect(draftRoadSpace(draft)).toEqual(first)
        expect(hasManualDraft(draft)).toBe(true)

        draft = undoDraft(draft)
        expect(draftRoadSpace(draft)).toBeUndefined()
        expect(hasManualDraft(draft)).toBe(false)
        expect(undoDraft(draft)).toEqual(draft)
    })

    it('does not count an automatic shape as a manual selection', () => {
        expect(hasManualDraft(emptyDraft())).toBe(false)
        expect(rotateRoad(emptyDraft(), 1)).toEqual(emptyDraft())
        const spaceOnly = chooseRoadSpace(emptyDraft(), first)
        expect(draftRoadShape(spaceOnly)).toBeUndefined()
        expect(undoDraft(spaceOnly)).toEqual(emptyDraft())
    })

    it('refuses a shape before a space is chosen', () => {
        expect(() => chooseRoadShape(emptyDraft(), RoadShape.Straight)).toThrow()
    })

    it('keeps the resupply picker and road laying mutually exclusive', () => {
        let draft = toggleResupply(chooseRoadSpace(emptyDraft(), first))
        expect(draftResupplyOpen(draft)).toBe(true)
        expect(draftRoadSpace(draft)).toBeUndefined()
        expect(hasManualDraft(draft)).toBe(true)

        draft = chooseRoadSpace(draft, second)
        expect(draftResupplyOpen(draft)).toBe(false)
        expect(draftRoadSpace(draft)).toEqual(second)

        draft = toggleResupply(draft)
        expect(draftResupplyOpen(undoDraft(draft))).toBe(false)
        expect(draftResupplyOpen(toggleResupply(draft))).toBe(false)
    })

    it('opens the resupply picker as a manual stage that Undo closes', () => {
        const tool = chooseTool(emptyDraft(), BuildTool.City, '0:1')
        const carried = carryTool(tool, '0:1')
        const draft = toggleResupply(carried)
        expect(hasManualDraft(draft)).toBe(true)
        expect(undoDraft(draft)).toEqual(carried)
        expect(hasManualDraft(undoDraft(draft))).toBe(false)
        expect(carryTool(toggleResupply(tool), '0:1')).toEqual(carried)
    })

    it('cancelling the widget clears only the road stages', () => {
        const draft = chooseRoadShape(chooseRoadSpace(emptyDraft(), first), RoadShape.Curve)
        expect(clearRoadLay(draft)).toEqual(emptyDraft())
    })

    it('counts a chosen tool as a manual selection that Undo clears', () => {
        const draft = chooseTool(emptyDraft(), BuildTool.City, '0:1')
        expect(draftTool(draft)).toEqual({ tool: BuildTool.City, turnKey: '0:1' })
        expect(hasManualDraft(draft)).toBe(true)
        expect(undoDraft(draft)).toEqual(emptyDraft())
    })

    it('Undo clears the road stages before the tool', () => {
        let draft = chooseRoadSpace(chooseTool(emptyDraft(), BuildTool.Road, '0:1'), first)
        draft = undoDraft(draft)
        expect(draftRoadSpace(draft)).toBeUndefined()
        expect(draftTool(draft)?.tool).toBe(BuildTool.Road)

        draft = undoDraft(draft)
        expect(draftTool(draft)).toBeUndefined()
    })

    it('clears the road stages when a tool is chosen', () => {
        const laying = chooseRoadShape(
            chooseRoadSpace(chooseTool(emptyDraft(), BuildTool.Road, '0:1'), first),
            RoadShape.Curve
        )
        const draft = chooseTool(laying, BuildTool.City, '0:1')
        expect(draftTool(draft)?.tool).toBe(BuildTool.City)
        expect(draftRoadSpace(draft)).toBeUndefined()
        expect(draftRoadShape(draft)).toBeUndefined()
    })

    it("carries this turn's tool as an automatic selection only", () => {
        const laying = chooseRoadSpace(chooseTool(emptyDraft(), BuildTool.Road, '0:1'), first)
        const carried = carryTool(laying, '0:1')
        expect(draftTool(carried)?.tool).toBe(BuildTool.Road)
        expect(draftRoadSpace(carried)).toBeUndefined()
        expect(hasManualDraft(carried)).toBe(false)
        expect(undoDraft(carried)).toEqual(carried)

        expect(carryTool(laying, '0:2')).toEqual(emptyDraft())
        expect(carryTool(carryTool(laying, '0:1'), '0:2')).toEqual(emptyDraft())
    })

    it('keeps the tool while the resupply picker is open', () => {
        let draft = toggleResupply(chooseTool(emptyDraft(), BuildTool.City, '0:1'))
        expect(draftResupplyOpen(draft)).toBe(true)
        expect(draftTool(draft)?.tool).toBe(BuildTool.City)

        draft = closeResupply(draft)
        expect(draftResupplyOpen(draft)).toBe(false)
        expect(draftTool(draft)?.tool).toBe(BuildTool.City)
    })

    it('skips the tile actions as a manual stage that Undo restores', () => {
        const draft = skipTiles(emptyDraft())
        expect(draftTilesSkipped(draft)).toBe(true)
        expect(hasManualDraft(draft)).toBe(true)
        expect(undoDraft(draft)).toEqual(emptyDraft())
    })

    it('keeps the skip under a market tool and Undo clears the tool first', () => {
        let draft = chooseTool(skipTiles(emptyDraft()), BuildTool.Market, '0:1')
        expect(draftTilesSkipped(draft)).toBe(true)
        draft = undoDraft(draft)
        expect(draftTool(draft)).toBeUndefined()
        expect(draftTilesSkipped(draft)).toBe(true)
        expect(draftTilesSkipped(undoDraft(draft))).toBe(false)
    })

    it('clears the skip when a tile tool is chosen', () => {
        const draft = chooseTool(skipTiles(emptyDraft()), BuildTool.City, '0:1')
        expect(draftTilesSkipped(draft)).toBe(false)
        expect(draftTool(draft)?.tool).toBe(BuildTool.City)
    })

    it('asks to confirm End turn as a manual stage that Undo cancels', () => {
        const tool = chooseTool(emptyDraft(), BuildTool.City, '0:1')
        const draft = askToConfirmEndTurn(tool)
        expect(draftConfirmingEndTurn(draft)).toBe(true)
        expect(draftTool(draft)?.tool).toBe(BuildTool.City)
        expect(undoDraft(draft)).toEqual(tool)
        expect(dropEndTurnConfirm(draft)).toEqual(tool)
    })

    it('closes the picker and the road being laid when End turn asks to confirm', () => {
        const laying = chooseRoadSpace(chooseTool(emptyDraft(), BuildTool.Road, '0:1'), first)
        expect(draftRoadSpace(askToConfirmEndTurn(laying))).toBeUndefined()
        const resupplying = toggleResupply(emptyDraft())
        expect(draftResupplyOpen(askToConfirmEndTurn(resupplying))).toBe(false)
    })

    it('drops the End turn confirm when an earlier choice is made', () => {
        const draft = askToConfirmEndTurn(emptyDraft())
        expect(draftConfirmingEndTurn(chooseTool(draft, BuildTool.City, '0:1'))).toBe(false)
        expect(draftConfirmingEndTurn(skipTiles(draft))).toBe(false)
        expect(draftConfirmingEndTurn(toggleResupply(draft))).toBe(false)
        expect(draftConfirmingEndTurn(carryTool(draft, '0:1'))).toBe(false)
    })

    it('does not carry a skip into the next published state', () => {
        const draft = chooseTool(skipTiles(emptyDraft()), BuildTool.Market, '0:1')
        expect(draftTilesSkipped(carryTool(draft, '0:1'))).toBe(false)
    })
})
