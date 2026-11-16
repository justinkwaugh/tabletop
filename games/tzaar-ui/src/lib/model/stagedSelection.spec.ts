import { describe, expect, it } from 'vitest'
import {
    hasManualStagedSelection,
    popHighestManualStagedSelection
} from '@tabletop/frontend-components'
import {
    setTzaarSelection,
    TzaarStageOrder,
    type TzaarSelection,
    type TzaarSelectionValues
} from './stagedSelection.js'

const popTzaarSelection = (selection: TzaarSelection) =>
    popHighestManualStagedSelection<TzaarSelectionValues>(selection, TzaarStageOrder).nextState
const hasManualTzaarSelection = (selection: TzaarSelection) =>
    hasManualStagedSelection<TzaarSelectionValues>(selection, TzaarStageOrder)

describe('tzaar staged selection', () => {
    it('choosing another stack replaces the chosen one', () => {
        const chosen = setTzaarSelection({}, 'from', 10)
        expect(setTzaarSelection(chosen, 'from', 11)).toEqual({
            from: { value: 11, source: 'manual' }
        })
    })

    it('Undo lets go of the chosen stack', () => {
        expect(popTzaarSelection(setTzaarSelection({}, 'from', 10))).toEqual({})
    })

    it('choosing the chosen stack again lets go of it', () => {
        const chosen = setTzaarSelection({}, 'from', 10)
        expect(setTzaarSelection(chosen, 'from', undefined)).toEqual({})
    })

    it('an auto selection does not absorb Undo', () => {
        const selection: TzaarSelection = { from: { value: 10, source: 'auto' } }
        expect(hasManualTzaarSelection(selection)).toBe(false)
        expect(popTzaarSelection(selection)).toEqual(selection)
    })
})
