import { describe, expect, it } from 'vitest'
import {
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue
} from '@tabletop/frontend-components'
import {
    setYinshSelection,
    YinshStageOrder,
    type YinshSelection,
    type YinshSelectionValues
} from './stagedSelection.js'

const popYinshSelection = (selection: YinshSelection) =>
    popHighestManualStagedSelection<YinshSelectionValues>(selection, YinshStageOrder).nextState
const hasManualYinshSelection = (selection: YinshSelection) =>
    hasManualStagedSelection<YinshSelectionValues>(selection, YinshStageOrder)

describe('yinsh staged selection', () => {
    it('throws for a stage outside its stage order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, number>, string>(
                {},
                YinshStageOrder,
                'notAStage',
                1,
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })

    it('choosing another ring replaces the chosen one', () => {
        const chosen = setYinshSelection({}, 'from', 10)
        expect(setYinshSelection(chosen, 'from', 11)).toEqual({
            from: { value: 11, source: 'manual' }
        })
    })

    it('setting a stage clears the stages after it', () => {
        const both = setYinshSelection(setYinshSelection({}, 'from', 10), 'anchor', 20)
        expect(setYinshSelection(both, 'from', 11)).toEqual({
            from: { value: 11, source: 'manual' }
        })
        expect(setYinshSelection(both, 'from', undefined)).toEqual({})
    })

    it('Undo lets go of the chosen ring', () => {
        expect(popYinshSelection(setYinshSelection({}, 'from', 10))).toEqual({})
    })

    it('Undo lets go of the chosen row end', () => {
        expect(popYinshSelection(setYinshSelection({}, 'anchor', 10))).toEqual({})
    })

    it('an auto selection does not absorb Undo', () => {
        const selection: YinshSelection = { from: { value: 10, source: 'auto' } }
        expect(hasManualYinshSelection(selection)).toBe(false)
        expect(popYinshSelection(selection)).toEqual(selection)
    })
})
