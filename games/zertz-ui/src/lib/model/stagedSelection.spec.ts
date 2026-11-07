import { describe, expect, it } from 'vitest'
import { MarbleColor } from '@tabletop/zertz'
import {
    hasManualZertzSelection,
    popZertzSelection,
    restagedZertzSelection,
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

    it('changing the colour clears the ring the marble stood on', () => {
        const placed = setZertzSelection(
            setZertzSelection({}, 'color', MarbleColor.White),
            'place',
            { q: 1, r: 0 }
        )
        expect(setZertzSelection(placed, 'color', MarbleColor.Grey)).toEqual({
            color: { value: MarbleColor.Grey, source: 'manual' }
        })
    })

    it('Undo takes the staged marble off its ring before letting go of its colour', () => {
        const placed = setZertzSelection(
            setZertzSelection({}, 'color', MarbleColor.White),
            'place',
            { q: 1, r: 0 }
        )
        const offRing = popZertzSelection(placed)
        expect(offRing).toEqual({ color: { value: MarbleColor.White, source: 'manual' } })
        expect(popZertzSelection(offRing)).toEqual({})
    })

    it('restages an undone move, with its colour only when there was a choice', () => {
        const move = { color: MarbleColor.Black, coords: { q: 2, r: -1 } }
        expect(restagedZertzSelection(move, true)).toEqual({
            color: { value: MarbleColor.Black, source: 'manual' },
            place: { value: { q: 2, r: -1 }, source: 'manual' }
        })
        expect(restagedZertzSelection(move, false)).toEqual({
            place: { value: { q: 2, r: -1 }, source: 'manual' }
        })
    })
})
