import { describe, expect, it } from 'vitest'
import {
    hasManualGipfSelection,
    popGipfSelection,
    restagedGipfSelection,
    setGipfSelection,
    type GipfSelection
} from './stagedSelection.js'

describe('gipf staged selection', () => {
    it('choosing the piece type clears a later dot', () => {
        const withDot = setGipfSelection({}, 'dot', { q: 0, r: 4 })
        expect(setGipfSelection(withDot, 'gipf', true)).toEqual({
            gipf: { value: true, source: 'manual' }
        })
    })

    it('Undo pops the highest manual stage', () => {
        const selection = setGipfSelection(setGipfSelection({}, 'row', '0,3|0,0'), 'keep', ['0,3'])
        expect(popGipfSelection(selection)).toEqual({ row: { value: '0,3|0,0', source: 'manual' } })
    })

    it('an auto selection does not absorb Undo', () => {
        const selection: GipfSelection = { row: { value: '0,3|0,0', source: 'auto' } }
        expect(hasManualGipfSelection(selection)).toBe(false)
    })

    it('clearing a stage removes it and later stages', () => {
        const selection = setGipfSelection(setGipfSelection({}, 'dot', { q: 0, r: 4 }), 'row', 'x')
        expect(setGipfSelection(selection, 'dot', undefined)).toEqual({})
    })

    describe('a push taken back by Undo', () => {
        const push = { gipf: true, dot: { q: 0, r: 4 } }

        it('stands on its dot as you chose it', () => {
            expect(restagedGipfSelection(push, true)).toEqual({
                gipf: { value: true, source: 'manual' },
                dot: { value: { q: 0, r: 4 }, source: 'manual' }
            })
        })

        it('is taken off its dot by the next Undo, then its piece type by the one after', () => {
            const offDot = popGipfSelection(restagedGipfSelection(push, true))
            expect(offDot).toEqual({ gipf: { value: true, source: 'manual' } })
            expect(hasManualGipfSelection(popGipfSelection(offDot))).toBe(false)
        })

        it('keeps no piece type when there was none to choose', () => {
            const selection = restagedGipfSelection(push, false)
            expect(selection).toEqual({ dot: { value: { q: 0, r: 4 }, source: 'manual' } })
            expect(hasManualGipfSelection(popGipfSelection(selection))).toBe(false)
        })
    })
})
