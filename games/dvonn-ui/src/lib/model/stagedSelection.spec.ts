import { describe, expect, it } from 'vitest'
import {
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue
} from '@tabletop/frontend-components'
import {
    DvonnStageOrder,
    setDvonnSelection,
    type DvonnSelection,
    type DvonnSelectionValues
} from './stagedSelection.js'

const popDvonnSelection = (selection: DvonnSelection) =>
    popHighestManualStagedSelection<DvonnSelectionValues>(selection, DvonnStageOrder).nextState
const hasManualDvonnSelection = (selection: DvonnSelection) =>
    hasManualStagedSelection<DvonnSelectionValues>(selection, DvonnStageOrder)

describe('dvonn staged selection', () => {
    it('throws for a stage outside its stage order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, number>, string>(
                {},
                DvonnStageOrder,
                'notAStage',
                1,
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })

    it('choosing another stack replaces the chosen one', () => {
        const chosen = setDvonnSelection({}, 'from', 10)
        expect(setDvonnSelection(chosen, 'from', 11)).toEqual({
            from: { value: 11, source: 'manual' }
        })
    })

    it('letting go clears the stage', () => {
        expect(setDvonnSelection(setDvonnSelection({}, 'from', 10), 'from', undefined)).toEqual({})
    })

    it('Undo lets go of the chosen stack', () => {
        expect(popDvonnSelection(setDvonnSelection({}, 'from', 10))).toEqual({})
    })

    it('an auto selection does not absorb Undo', () => {
        const selection: DvonnSelection = { from: { value: 10, source: 'auto' } }
        expect(hasManualDvonnSelection(selection)).toBe(false)
        expect(popDvonnSelection(selection)).toEqual(selection)
    })
})
