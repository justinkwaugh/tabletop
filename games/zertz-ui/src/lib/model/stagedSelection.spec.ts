import { describe, expect, it } from 'vitest'
import { MarbleColor } from '@tabletop/zertz'
import {
    hasManualZertzSelection,
    popZertzSelection,
    setZertzSelection,
    type ZertzSelection
} from './stagedSelection.js'

describe('zertz staged selection', () => {
    it('setting the colour clears a later jumper stage', () => {
        const withJumper = setZertzSelection({}, 'jumper', { q: 0, r: 0 })
        const next = setZertzSelection(withJumper, 'color', MarbleColor.White)
        expect(next).toEqual({ color: { value: MarbleColor.White, source: 'manual' } })
    })

    it('Undo pops the manual selection', () => {
        const selection = setZertzSelection({}, 'jumper', { q: 1, r: 0 })
        expect(hasManualZertzSelection(selection)).toBe(true)
        expect(popZertzSelection(selection)).toEqual({})
    })

    it('an auto selection does not absorb Undo', () => {
        const selection: ZertzSelection = { color: { value: MarbleColor.Grey, source: 'auto' } }
        expect(hasManualZertzSelection(selection)).toBe(false)
    })

    it('clearing a stage removes it', () => {
        const selection = setZertzSelection({}, 'color', MarbleColor.Black)
        expect(setZertzSelection(selection, 'color', undefined)).toEqual({})
    })
})
