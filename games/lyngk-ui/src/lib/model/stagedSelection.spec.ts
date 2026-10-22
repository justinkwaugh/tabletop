import { describe, expect, it } from 'vitest'
import {
    hasManualLyngkSelection,
    popLyngkSelection,
    setLyngkSelection,
    type LyngkSelection
} from './stagedSelection.js'

describe('lyngk staged selection', () => {
    it('choosing another stack replaces the chosen one', () => {
        const chosen = setLyngkSelection({}, 'from', '0,0')
        expect(setLyngkSelection(chosen, 'from', '1,0')).toEqual({
            from: { value: '1,0', source: 'manual' }
        })
    })

    it('Undo lets go of the chosen stack', () => {
        expect(popLyngkSelection(setLyngkSelection({}, 'from', '0,0'))).toEqual({})
    })

    it('an auto selection does not absorb Undo', () => {
        const selection: LyngkSelection = { from: { value: '0,0', source: 'auto' } }
        expect(hasManualLyngkSelection(selection)).toBe(false)
    })
})
