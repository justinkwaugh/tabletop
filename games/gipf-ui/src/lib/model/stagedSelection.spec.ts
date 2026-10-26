import { describe, expect, it } from 'vitest'
import {
    hasManualGipfSelection,
    popGipfSelection,
    restagedGipfSelection,
    setGipfSelection,
    type GipfSelection
} from './stagedSelection.js'

describe('gipf staged selection', () => {
    it('choosing another dot clears the piece type', () => {
        const typed = setGipfSelection(setGipfSelection({}, 'dot', { q: 0, r: 4 }), 'gipf', true)
        expect(setGipfSelection(typed, 'dot', { q: 1, r: 4 })).toEqual({
            dot: { value: { q: 1, r: 4 }, source: 'manual' }
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
                dot: { value: { q: 0, r: 4 }, source: 'manual' },
                gipf: { value: true, source: 'manual' }
            })
        })

        it('turns back into a single piece with the next Undo, then leaves its dot', () => {
            const single = popGipfSelection(restagedGipfSelection(push, true))
            expect(single).toEqual({ dot: { value: { q: 0, r: 4 }, source: 'manual' } })
            expect(hasManualGipfSelection(popGipfSelection(single))).toBe(false)
        })

        it('stages only the dot for a single piece, which was not chosen', () => {
            expect(restagedGipfSelection({ ...push, gipf: false }, true)).toEqual({
                dot: { value: { q: 0, r: 4 }, source: 'manual' }
            })
        })

        it('keeps no piece type when there was none to choose', () => {
            const selection = restagedGipfSelection(push, false)
            expect(selection).toEqual({ dot: { value: { q: 0, r: 4 }, source: 'manual' } })
            expect(hasManualGipfSelection(popGipfSelection(selection))).toBe(false)
        })
    })
})
