import { describe, expect, it } from 'vitest'
import {
    hasManualTzaarSelection,
    popTzaarSelection,
    setTzaarSelection,
    type TzaarSelection
} from './stagedSelection.js'

describe('tzaar staged selection', () => {
    it('choosing another stack replaces the chosen one', () => {
        const chosen = setTzaarSelection({}, 'from', '0,0')
        expect(setTzaarSelection(chosen, 'from', '1,0')).toEqual({
            from: { value: '1,0', source: 'manual' }
        })
    })

    it('Undo lets go of the chosen stack', () => {
        expect(popTzaarSelection(setTzaarSelection({}, 'from', '0,0'))).toEqual({})
    })

    it('choosing the chosen stack again lets go of it', () => {
        const chosen = setTzaarSelection({}, 'from', '0,0')
        expect(setTzaarSelection(chosen, 'from', undefined)).toEqual({})
    })

    it('an auto selection does not absorb Undo', () => {
        const selection: TzaarSelection = { from: { value: '0,0', source: 'auto' } }
        expect(hasManualTzaarSelection(selection)).toBe(false)
    })
})
