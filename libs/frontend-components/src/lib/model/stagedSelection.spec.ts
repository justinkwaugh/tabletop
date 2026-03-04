import { describe, expect, it } from 'vitest'
import {
    clearStagedSelectionAtOrAfter,
    getHighestManualStagedSelectionStage,
    getStagedSelectionValue,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
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
