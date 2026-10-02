import { describe, expect, it } from 'vitest'
import { RoadShape, offsetToAxial } from '@tabletop/magna-grecia'
import { BuildTool } from './buildTool.js'
import {
    backDraft,
    carryTool,
    chooseRoadShape,
    chooseRoadSpace,
    chooseTool,
    clearRoadLay,
    closeResupply,
    draftRoadShape,
    draftRoadSpace,
    draftTool,
    emptyDraft,
    hasManualDraft,
    rotateRoad,
    toggleResupply
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

    it('backs out the highest manual stage first', () => {
        let draft = chooseRoadShape(chooseRoadSpace(emptyDraft(), first), RoadShape.Curve)
        draft = backDraft(draft)
        expect(draftRoadShape(draft)).toBeUndefined()
        expect(draftRoadSpace(draft)).toEqual(first)
        expect(hasManualDraft(draft)).toBe(true)

        draft = backDraft(draft)
        expect(draftRoadSpace(draft)).toBeUndefined()
        expect(hasManualDraft(draft)).toBe(false)
        expect(backDraft(draft)).toEqual(draft)
    })

    it('does not count an automatic shape as a manual selection', () => {
        expect(hasManualDraft(emptyDraft())).toBe(false)
        expect(rotateRoad(emptyDraft(), 1)).toEqual(emptyDraft())
        const spaceOnly = chooseRoadSpace(emptyDraft(), first)
        expect(draftRoadShape(spaceOnly)).toBeUndefined()
        expect(backDraft(spaceOnly)).toEqual(emptyDraft())
    })

    it('refuses a shape before a space is chosen', () => {
        expect(() => chooseRoadShape(emptyDraft(), RoadShape.Straight)).toThrow()
    })

    it('keeps the resupply picker and road laying mutually exclusive', () => {
        let draft = toggleResupply(chooseRoadSpace(emptyDraft(), first))
        expect(draft.resupplyOpen).toBe(true)
        expect(draftRoadSpace(draft)).toBeUndefined()
        expect(hasManualDraft(draft)).toBe(true)

        draft = chooseRoadSpace(draft, second)
        expect(draft.resupplyOpen).toBe(false)

        draft = toggleResupply(draft)
        expect(backDraft(draft)).toEqual({ ...draft, resupplyOpen: false })
        expect(toggleResupply(draft).resupplyOpen).toBe(false)
    })

    it('cancelling the widget clears only the road stages', () => {
        const draft = chooseRoadShape(chooseRoadSpace(emptyDraft(), first), RoadShape.Curve)
        expect(clearRoadLay(draft)).toEqual(emptyDraft())
    })

    it('counts a chosen tool as a manual selection that Back clears', () => {
        const draft = chooseTool(emptyDraft(), BuildTool.City, '0:1')
        expect(draftTool(draft)).toEqual({ tool: BuildTool.City, turnKey: '0:1' })
        expect(hasManualDraft(draft)).toBe(true)
        expect(backDraft(draft)).toEqual(emptyDraft())
    })

    it('backs out the road stages before the tool', () => {
        let draft = chooseRoadSpace(chooseTool(emptyDraft(), BuildTool.Road, '0:1'), first)
        draft = backDraft(draft)
        expect(draftRoadSpace(draft)).toBeUndefined()
        expect(draftTool(draft)?.tool).toBe(BuildTool.Road)

        draft = backDraft(draft)
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
        expect(backDraft(carried)).toEqual(carried)

        expect(carryTool(laying, '0:2')).toEqual(emptyDraft())
        expect(carryTool(carryTool(laying, '0:1'), '0:2')).toEqual(emptyDraft())
    })

    it('keeps the tool while the resupply picker is open', () => {
        let draft = toggleResupply(chooseTool(emptyDraft(), BuildTool.City, '0:1'))
        expect(draft.resupplyOpen).toBe(true)
        expect(draftTool(draft)?.tool).toBe(BuildTool.City)

        draft = closeResupply(draft)
        expect(draft.resupplyOpen).toBe(false)
        expect(draftTool(draft)?.tool).toBe(BuildTool.City)
    })
})
