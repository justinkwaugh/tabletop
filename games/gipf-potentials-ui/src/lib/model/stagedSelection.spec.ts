import { describe, expect, it } from 'vitest'
import {
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue
} from '@tabletop/frontend-components'
import {
    GipfPotentialsStageOrder,
    pushGipfPotentialsKeep,
    setGipfPotentialsSelection,
    type GipfPotentialsSelection,
    type GipfPotentialsSelectionValues
} from './stagedSelection.js'

const popGipfPotentialsSelection = (selection: GipfPotentialsSelection) =>
    popHighestManualStagedSelection<GipfPotentialsSelectionValues>(
        selection,
        GipfPotentialsStageOrder
    ).nextState
const hasManualGipfPotentialsSelection = (selection: GipfPotentialsSelection) =>
    hasManualStagedSelection<GipfPotentialsSelectionValues>(selection, GipfPotentialsStageOrder)

describe('GIPF with Potentials staged selection', () => {
    it('throws for a stage outside its stage order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, string>, string>(
                {},
                GipfPotentialsStageOrder,
                'notAStage',
                'x',
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })

    it('choosing a piece to move clears a chosen dot and row', () => {
        const later = setGipfPotentialsSelection(
            setGipfPotentialsSelection({}, 'dot', { q: 0, r: 4 }),
            'row',
            'x'
        )
        expect(setGipfPotentialsSelection(later, 'from', { q: 1, r: 2 })).toEqual({
            from: { value: { q: 1, r: 2 }, source: 'manual' }
        })
    })

    it('choosing another dot keeps the piece chosen before it', () => {
        const chosen = setGipfPotentialsSelection(
            setGipfPotentialsSelection({}, 'from', { q: 1, r: 2 }),
            'dot',
            {
                q: 0,
                r: 4
            }
        )
        expect(setGipfPotentialsSelection(chosen, 'dot', { q: -1, r: 4 })).toEqual({
            from: { value: { q: 1, r: 2 }, source: 'manual' },
            dot: { value: { q: -1, r: 4 }, source: 'manual' }
        })
    })

    it('choosing another piece to move clears the GIPF-piece its PÜNCT would cover', () => {
        const covering = setGipfPotentialsSelection(
            setGipfPotentialsSelection({}, 'from', { q: 1, r: 2 }),
            'to',
            { q: 1, r: 1 }
        )
        expect(setGipfPotentialsSelection(covering, 'from', { q: -1, r: 2 })).toEqual({
            from: { value: { q: -1, r: 2 }, source: 'manual' }
        })
    })

    it('Undo pops the highest manual stage', () => {
        const selection = setGipfPotentialsSelection(
            setGipfPotentialsSelection({}, 'from', { q: 1, r: 2 }),
            'row',
            'x'
        )
        expect(popGipfPotentialsSelection(selection)).toEqual({
            from: { value: { q: 1, r: 2 }, source: 'manual' }
        })
    })

    it('an auto selection does not absorb Undo', () => {
        const selection: GipfPotentialsSelection = { row: { value: 'x', source: 'auto' } }
        expect(hasManualGipfPotentialsSelection(selection)).toBe(false)
    })

    it('clearing a stage removes it and later stages', () => {
        const selection = setGipfPotentialsSelection(
            setGipfPotentialsSelection({}, 'dot', { q: 0, r: 4 }),
            'row',
            'x'
        )
        expect(setGipfPotentialsSelection(selection, 'dot', undefined)).toEqual({})
    })

    describe('pieces left in a chosen row', () => {
        const row = setGipfPotentialsSelection({}, 'row', '3|0')

        it('Undo takes back the latest tap and keeps the earlier ones', () => {
            const twice = pushGipfPotentialsKeep(pushGipfPotentialsKeep(row, [3]), [3, 7])
            expect(popGipfPotentialsSelection(twice)).toEqual(pushGipfPotentialsKeep(row, [3]))
        })

        it('Undo of the first tap leaves the row chosen', () => {
            expect(popGipfPotentialsSelection(pushGipfPotentialsKeep(row, [3]))).toEqual(row)
        })

        it('choosing another row clears every tap', () => {
            const kept = pushGipfPotentialsKeep(pushGipfPotentialsKeep(row, [3]), [3, 7])
            expect(setGipfPotentialsSelection(kept, 'row', '5|9')).toEqual({
                row: { value: '5|9', source: 'manual' }
            })
        })
    })
})
