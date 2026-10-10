import { describe, expect, it } from 'vitest'
import { setStagedSelectionValue } from '@tabletop/frontend-components'
import { ActionType } from '@tabletop/fresh-fish'
import {
    FreshFishStageOrder,
    hasManualFreshFishSelection,
    popFreshFishSelection,
    setFreshFishSelection,
    type FreshFishSelection
} from './stagedSelection.js'

describe('Fresh Fish staged selection', () => {
    it('throws for a stage outside its stage order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, string>, string>(
                {},
                FreshFishStageOrder,
                'notAStage',
                'x',
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })

    it('records a chosen action as a manual selection', () => {
        const selection = setFreshFishSelection({}, 'action', ActionType.PlaceDisk)
        expect(selection.action).toEqual({ value: ActionType.PlaceDisk, source: 'manual' })
        expect(hasManualFreshFishSelection(selection)).toBe(true)
    })

    it('replaces an earlier choice when another action is chosen', () => {
        let selection: FreshFishSelection = setFreshFishSelection(
            {},
            'action',
            ActionType.PlaceDisk
        )
        selection = setFreshFishSelection(selection, 'action', ActionType.DrawTile)
        expect(selection.action?.value).toBe(ActionType.DrawTile)
    })

    it('pops the manual choice so Undo returns to the action choices', () => {
        const selection = setFreshFishSelection({}, 'action', ActionType.PlaceDisk)
        const popped = popFreshFishSelection(selection)
        expect(popped.action).toBeUndefined()
        expect(hasManualFreshFishSelection(popped)).toBe(false)
    })

    it('has nothing to pop without a manual choice', () => {
        expect(hasManualFreshFishSelection({})).toBe(false)
        expect(popFreshFishSelection({})).toEqual({})
    })
})
