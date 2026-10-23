import { describe, expect, it } from 'vitest'
import {
    hasManualYinshSelection,
    popYinshSelection,
    setYinshSelection,
    type YinshSelection
} from './stagedSelection.js'

describe('yinsh staged selection', () => {
    it('choosing another ring replaces the chosen one', () => {
        const chosen = setYinshSelection({}, 'from', '0,0')
        expect(setYinshSelection(chosen, 'from', '1,0')).toEqual({
            from: { value: '1,0', source: 'manual' }
        })
    })

    it('Undo lets go of the chosen ring', () => {
        expect(popYinshSelection(setYinshSelection({}, 'from', '0,0'))).toEqual({})
    })

    it('Undo lets go of the chosen row end', () => {
        expect(popYinshSelection(setYinshSelection({}, 'anchor', '0,0'))).toEqual({})
    })

    it('an auto selection does not absorb Undo', () => {
        const selection: YinshSelection = { from: { value: '0,0', source: 'auto' } }
        expect(hasManualYinshSelection(selection)).toBe(false)
    })
})
