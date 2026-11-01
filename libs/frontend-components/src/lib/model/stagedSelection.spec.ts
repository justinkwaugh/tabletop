import { describe, expect, it } from 'vitest'
import {
    clearStagedSelectionAtOrAfter,
    getHighestManualStagedSelectionStage,
    getStagedSelectionEntry,
    getStagedSelectionValue,
    popHighestManualStagedSelection,
    pushStagedSelectionValue,
    setStagedSelectionValue,
    undoableStagedSelection,
    type StagedSelectionState
} from './stagedSelection.js'

type TestSelection = {
    one: string
    two: string
    three: string
}

const STAGE_ORDER = ['one', 'two', 'three'] as const satisfies readonly (keyof TestSelection)[]

describe('stagedSelection', () => {
    it('sets a stage and clears downstream stages', () => {
        const initialState: StagedSelectionState<TestSelection> = {
            one: { value: 'A', source: 'manual' },
            two: { value: 'B', source: 'manual' },
            three: { value: 'C', source: 'auto' }
        }

        const nextState = setStagedSelectionValue(initialState, STAGE_ORDER, 'two', 'B2', 'manual')

        expect(getStagedSelectionValue(nextState, 'one')).toBe('A')
        expect(getStagedSelectionValue(nextState, 'two')).toBe('B2')
        expect(getStagedSelectionValue(nextState, 'three')).toBeUndefined()
    })

    it('pops the highest manual stage and clears downstream stages', () => {
        const initialState: StagedSelectionState<TestSelection> = {
            one: { value: 'A', source: 'manual' },
            two: { value: 'B', source: 'manual' },
            three: { value: 'C', source: 'auto' }
        }

        const { nextState, poppedStage } = popHighestManualStagedSelection(
            initialState,
            STAGE_ORDER
        )

        expect(poppedStage).toBe('two')
        expect(getStagedSelectionValue(nextState, 'one')).toBe('A')
        expect(getStagedSelectionValue(nextState, 'two')).toBeUndefined()
        expect(getStagedSelectionValue(nextState, 'three')).toBeUndefined()
    })

    it('returns unchanged state when no manual stage exists', () => {
        const initialState: StagedSelectionState<TestSelection> = {
            one: { value: 'A', source: 'auto' }
        }

        const { nextState, poppedStage } = popHighestManualStagedSelection(
            initialState,
            STAGE_ORDER
        )

        expect(poppedStage).toBeUndefined()
        expect(nextState).toBe(initialState)
    })

    it('finds highest manual stage', () => {
        const initialState: StagedSelectionState<TestSelection> = {
            one: { value: 'A', source: 'manual' },
            two: { value: 'B', source: 'auto' },
            three: { value: 'C', source: 'manual' }
        }

        expect(getHighestManualStagedSelectionStage(initialState, STAGE_ORDER)).toBe('three')
    })

    it('throws when clearing with a stage not present in stage order', () => {
        const initialState: StagedSelectionState<TestSelection> = {
            one: { value: 'A', source: 'manual' }
        }

        expect(() =>
            clearStagedSelectionAtOrAfter(
                initialState,
                STAGE_ORDER,
                'missing' as unknown as keyof TestSelection
            )
        ).toThrowError('does not exist in stage order')
    })
})

describe('undoableStagedSelection', () => {
    function held(initial: StagedSelectionState<TestSelection>) {
        let state = initial
        const undoable = undoableStagedSelection<TestSelection>(
            STAGE_ORDER,
            () => state,
            (next) => (state = next)
        )
        return { undoable, current: () => state }
    }

    it('pops the highest manual stage on Undo', () => {
        const { undoable, current } = held({
            one: { value: 'A', source: 'manual' },
            two: { value: 'B', source: 'manual' }
        })
        expect(undoable.hasManual()).toBe(true)
        expect(undoable.undo()).toBe(true)
        expect(current()).toEqual({ one: { value: 'A', source: 'manual' } })
    })

    it('leaves Undo to the last action when only automatic stages are set', () => {
        const automatic: StagedSelectionState<TestSelection> = {
            one: { value: 'A', source: 'auto' }
        }
        const { undoable, current } = held(automatic)
        expect(undoable.hasManual()).toBe(false)
        expect(undoable.undo()).toBe(false)
        expect(current()).toBe(automatic)
    })

    it('clears every stage', () => {
        const { undoable, current } = held({ one: { value: 'A', source: 'manual' } })
        undoable.clear()
        expect(current()).toEqual({})
    })
})

describe('pushStagedSelectionValue', () => {
    type Draft = { edits: string[]; picked: string }
    const DRAFT_ORDER = ['edits', 'picked'] as const satisfies readonly (keyof Draft)[]

    function pushed(...edits: string[]): StagedSelectionState<Draft> {
        let state: StagedSelectionState<Draft> = {}
        const entries: string[] = []
        for (const edit of edits) {
            entries.push(edit)
            state = pushStagedSelectionValue(state, DRAFT_ORDER, 'edits', [...entries])
        }
        return state
    }

    it('takes back one press per Undo, then clears the stage', () => {
        let state = pushed('a', 'b', 'c')
        expect(getStagedSelectionValue(state, 'edits')).toEqual(['a', 'b', 'c'])

        state = popHighestManualStagedSelection(state, DRAFT_ORDER).nextState
        expect(getStagedSelectionValue(state, 'edits')).toEqual(['a', 'b'])
        state = popHighestManualStagedSelection(state, DRAFT_ORDER).nextState
        expect(getStagedSelectionValue(state, 'edits')).toEqual(['a'])
        state = popHighestManualStagedSelection(state, DRAFT_ORDER).nextState
        expect(state).toEqual({})
    })

    it('clears later stages, and Undo pops an open later stage before any press', () => {
        let state = setStagedSelectionValue(pushed('a'), DRAFT_ORDER, 'picked', 'x', 'manual')

        state = popHighestManualStagedSelection(state, DRAFT_ORDER).nextState
        expect(getStagedSelectionValue(state, 'picked')).toBeUndefined()
        expect(getStagedSelectionValue(state, 'edits')).toEqual(['a'])

        state = setStagedSelectionValue(state, DRAFT_ORDER, 'picked', 'x', 'manual')
        state = pushStagedSelectionValue(state, DRAFT_ORDER, 'edits', ['a', 'b'])
        expect(getStagedSelectionValue(state, 'picked')).toBeUndefined()
        expect(getStagedSelectionValue(state, 'edits')).toEqual(['a', 'b'])
    })

    it('restores the value a press replaced, whether set or pushed', () => {
        let state: StagedSelectionState<Draft> = setStagedSelectionValue(
            {},
            DRAFT_ORDER,
            'edits',
            ['set'],
            'auto'
        )
        state = pushStagedSelectionValue(state, DRAFT_ORDER, 'edits', ['set', 'pushed'])
        state = popHighestManualStagedSelection(state, DRAFT_ORDER).nextState
        expect(getStagedSelectionEntry(state, 'edits')).toEqual({ value: ['set'], source: 'auto' })
        expect(getHighestManualStagedSelectionStage(state, DRAFT_ORDER)).toBeUndefined()
    })
})
