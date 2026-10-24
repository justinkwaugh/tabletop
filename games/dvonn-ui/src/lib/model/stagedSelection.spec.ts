import { describe, expect, it } from 'vitest'
import {
    hasManualDvonnSelection,
    popDvonnSelection,
    setDvonnSelection,
    type DvonnSelection
} from './stagedSelection.js'

describe('dvonn staged selection', () => {
    it('choosing another stack replaces the chosen one', () => {
        const chosen = setDvonnSelection({}, 'from', '0,0')
        expect(setDvonnSelection(chosen, 'from', '1,0')).toEqual({
            from: { value: '1,0', source: 'manual' }
        })
    })

    it('Undo lets go of the chosen stack', () => {
        expect(popDvonnSelection(setDvonnSelection({}, 'from', '0,0'))).toEqual({})
    })

    it('choosing the chosen stack again lets go of it', () => {
        const chosen = setDvonnSelection({}, 'from', '0,0')
        expect(setDvonnSelection(chosen, 'from', undefined)).toEqual({})
    })

    it('an auto selection does not absorb Undo', () => {
        const selection: DvonnSelection = { from: { value: '0,0', source: 'auto' } }
        expect(hasManualDvonnSelection(selection)).toBe(false)
    })
})
