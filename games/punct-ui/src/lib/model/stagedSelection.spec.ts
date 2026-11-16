import { describe, expect, it } from 'vitest'
import {
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue
} from '@tabletop/frontend-components'
import {
    PunctStageOrder,
    setPunctSelection,
    type PunctSelection,
    type PunctSelectionValues
} from './stagedSelection.js'

const pop = (selection: PunctSelection) =>
    popHighestManualStagedSelection<PunctSelectionValues>(selection, PunctStageOrder).nextState
const hasManual = (selection: PunctSelection) =>
    hasManualStagedSelection<PunctSelectionValues>(selection, PunctStageOrder)

const FROM = { q: 0, r: 3 }
const AT = { q: 0, r: 1 }

describe('punct staged selection', () => {
    it('throws for a stage outside its stage order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, string>, string>(
                {},
                PunctStageOrder,
                'notAStage',
                'x',
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })

    it('choosing another space clears the turn', () => {
        const turned = setPunctSelection(setPunctSelection({}, 'at', AT), 'rotation', 2)
        expect(setPunctSelection(turned, 'at', FROM)).toEqual({
            at: { value: FROM, source: 'manual' }
        })
    })

    it('choosing another piece clears its space and turn', () => {
        const moving = setPunctSelection(setPunctSelection({}, 'from', FROM), 'at', AT)
        expect(setPunctSelection(setPunctSelection(moving, 'rotation', 1), 'from', AT)).toEqual({
            from: { value: AT, source: 'manual' }
        })
    })

    it('Undo pops the highest manual stage, the turn first', () => {
        const moving = setPunctSelection(setPunctSelection({}, 'from', FROM), 'at', AT)
        const turned = setPunctSelection(moving, 'rotation', 4)
        expect(pop(turned)).toEqual(moving)
        expect(pop(moving)).toEqual(setPunctSelection({}, 'from', FROM))
        expect(hasManual(pop(pop(moving)))).toBe(false)
    })

    it('an auto selection does not absorb Undo', () => {
        expect(hasManual({ at: { value: AT, source: 'auto' } })).toBe(false)
    })

    it('clearing a stage removes it and every later stage', () => {
        const turned = setPunctSelection(setPunctSelection({}, 'from', FROM), 'rotation', 3)
        expect(setPunctSelection(turned, 'from', undefined)).toEqual({})
    })
})
