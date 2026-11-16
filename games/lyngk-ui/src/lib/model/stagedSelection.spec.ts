import { describe, expect, it } from 'vitest'
import {
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue
} from '@tabletop/frontend-components'
import {
    LyngkStageOrder,
    setLyngkSelection,
    type LyngkSelection,
    type LyngkSelectionValues
} from './stagedSelection.js'

const popLyngkSelection = (selection: LyngkSelection) =>
    popHighestManualStagedSelection<LyngkSelectionValues>(selection, LyngkStageOrder).nextState
const hasManualLyngkSelection = (selection: LyngkSelection) =>
    hasManualStagedSelection<LyngkSelectionValues>(selection, LyngkStageOrder)

describe('lyngk staged selection', () => {
    it('throws for a stage outside its stage order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, number>, string>(
                {},
                LyngkStageOrder,
                'notAStage',
                1,
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })

    it('choosing another stack replaces the chosen one', () => {
        const chosen = setLyngkSelection({}, 'from', 10)
        expect(setLyngkSelection(chosen, 'from', 11)).toEqual({
            from: { value: 11, source: 'manual' }
        })
    })

    it('letting go clears the stage', () => {
        expect(setLyngkSelection(setLyngkSelection({}, 'from', 10), 'from', undefined)).toEqual({})
    })

    it('Undo lets go of the chosen stack', () => {
        expect(popLyngkSelection(setLyngkSelection({}, 'from', 10))).toEqual({})
    })

    it('an auto selection does not absorb Undo', () => {
        const selection: LyngkSelection = { from: { value: 10, source: 'auto' } }
        expect(hasManualLyngkSelection(selection)).toBe(false)
        expect(popLyngkSelection(selection)).toEqual(selection)
    })
})
