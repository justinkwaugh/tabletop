import { describe, expect, it } from 'vitest'
import {
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue
} from '@tabletop/frontend-components'
import {
    MatrxStageOrder,
    pushMatrxKeep,
    setMatrxSelection,
    type MatrxSelection,
    type MatrxSelectionValues
} from './stagedSelection.js'

const popMatrxSelection = (selection: MatrxSelection) =>
    popHighestManualStagedSelection<MatrxSelectionValues>(selection, MatrxStageOrder).nextState
const hasManualMatrxSelection = (selection: MatrxSelection) =>
    hasManualStagedSelection<MatrxSelectionValues>(selection, MatrxStageOrder)

describe('MATRX GIPF staged selection', () => {
    it('throws for a stage outside its stage order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, string>, string>(
                {},
                MatrxStageOrder,
                'notAStage',
                'x',
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })

    it('choosing a stack to move clears a chosen dot and row', () => {
        const later = setMatrxSelection(setMatrxSelection({}, 'dot', { q: 0, r: 4 }), 'row', 'x')
        expect(setMatrxSelection(later, 'from', { q: 1, r: 2 })).toEqual({
            from: { value: { q: 1, r: 2 }, source: 'manual' }
        })
    })

    it('choosing another dot keeps the stack chosen before it', () => {
        const chosen = setMatrxSelection(setMatrxSelection({}, 'from', { q: 1, r: 2 }), 'dot', {
            q: 0,
            r: 4
        })
        expect(setMatrxSelection(chosen, 'dot', { q: -1, r: 4 })).toEqual({
            from: { value: { q: 1, r: 2 }, source: 'manual' },
            dot: { value: { q: -1, r: 4 }, source: 'manual' }
        })
    })

    it('Undo pops the highest manual stage', () => {
        const selection = setMatrxSelection(
            setMatrxSelection({}, 'from', { q: 1, r: 2 }),
            'row',
            'x'
        )
        expect(popMatrxSelection(selection)).toEqual({
            from: { value: { q: 1, r: 2 }, source: 'manual' }
        })
    })

    it('an auto selection does not absorb Undo', () => {
        const selection: MatrxSelection = { row: { value: 'x', source: 'auto' } }
        expect(hasManualMatrxSelection(selection)).toBe(false)
    })

    it('clearing a stage removes it and later stages', () => {
        const selection = setMatrxSelection(
            setMatrxSelection({}, 'dot', { q: 0, r: 4 }),
            'row',
            'x'
        )
        expect(setMatrxSelection(selection, 'dot', undefined)).toEqual({})
    })

    describe('stacks left in a chosen row', () => {
        const row = setMatrxSelection({}, 'row', '3|0')

        it('Undo takes back the latest tap and keeps the earlier ones', () => {
            const twice = pushMatrxKeep(pushMatrxKeep(row, [3]), [3, 7])
            expect(popMatrxSelection(twice)).toEqual(pushMatrxKeep(row, [3]))
        })

        it('Undo of the first tap leaves the row chosen', () => {
            expect(popMatrxSelection(pushMatrxKeep(row, [3]))).toEqual(row)
        })

        it('choosing another row clears every tap', () => {
            const kept = pushMatrxKeep(pushMatrxKeep(row, [3]), [3, 7])
            expect(setMatrxSelection(kept, 'row', '5|9')).toEqual({
                row: { value: '5|9', source: 'manual' }
            })
        })
    })
})
