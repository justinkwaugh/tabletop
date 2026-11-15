import { describe, expect, it } from 'vitest'
import { undoableStagedSelection } from '@tabletop/frontend-components'
import {
    TakeoverStageOrder,
    TurnInStageOrder,
    chosenTurnInKind,
    stageTakeoverSwaps,
    stageTakeoverTarget,
    stageTurnInKind,
    takeoverSwaps,
    takeoverTarget,
    withSwaps,
    type TakeoverSelection,
    type TakeoverSelectionValues,
    type TurnInSelection,
    type TurnInSelectionValues
} from './takeoverSelection.js'

const alex = { kind: 'player' as const, playerId: 'alex' }
const market = { kind: 'bank' as const }

function undoable(initial: TakeoverSelection) {
    let selection = initial
    const undo = undoableStagedSelection<TakeoverSelectionValues>(
        TakeoverStageOrder,
        () => selection,
        (next) => (selection = next)
    )
    return { undo, get: () => selection }
}

describe('the takeover selection', () => {
    it('auto-selects the only target, which Undo passes over', () => {
        expect(takeoverTarget({}, ['HR'])).toEqual({ value: 'HR', source: 'auto' })
        expect(takeoverTarget({}, ['HR', 'RR'])).toBeUndefined()
        expect(undoable({}).undo.hasManual()).toBe(false)
    })

    it('keeps a chosen target while it is offered', () => {
        const chosen = stageTakeoverTarget({}, 'RR', undefined)
        expect(takeoverTarget(chosen, ['HR', 'RR'])).toEqual({ value: 'RR', source: 'manual' })
        expect(takeoverTarget(chosen, ['HR'])).toEqual({ value: 'HR', source: 'auto' })
    })

    it('records nothing when the shown target is chosen again', () => {
        const chosen = stageTakeoverTarget({}, 'HR', 'HR')
        expect(chosen).toEqual({})
    })

    it('offers the fewest swaps until the player sets their own', () => {
        const fewest = [{ holder: alex, shares: 1 }]
        expect(takeoverSwaps({}, fewest)).toEqual({ value: fewest, source: 'auto' })
        const set = stageTakeoverSwaps({}, [{ holder: market, shares: 2 }])
        expect(takeoverSwaps(set, fewest)).toEqual({
            value: [{ holder: market, shares: 2 }],
            source: 'manual'
        })
    })

    it('sets one holder’s swaps and drops holders swapping none', () => {
        const swaps = withSwaps([{ holder: alex, shares: 1 }], market, 2)
        expect(swaps).toEqual([
            { holder: alex, shares: 1 },
            { holder: market, shares: 2 }
        ])
        expect(withSwaps(swaps, alex, 0)).toEqual([{ holder: market, shares: 2 }])
    })

    it('undoes the swaps, then the target', () => {
        const target = stageTakeoverTarget({}, 'RR', undefined)
        const { undo, get } = undoable(stageTakeoverSwaps(target, [{ holder: alex, shares: 2 }]))
        expect(undo.undo()).toBe(true)
        expect(takeoverTarget(get(), ['HR', 'RR'])?.value).toBe('RR')
        expect(takeoverSwaps(get(), []).source).toBe('auto')
        expect(undo.undo()).toBe(true)
        expect(takeoverTarget(get(), ['HR', 'RR'])).toBeUndefined()
        expect(undo.undo()).toBe(false)
    })

    it('clears the swaps when a new target is chosen', () => {
        const swapped = stageTakeoverSwaps(stageTakeoverTarget({}, 'RR', undefined), [
            { holder: alex, shares: 2 }
        ])
        const retargeted = stageTakeoverTarget(swapped, 'HR', 'RR')
        expect(takeoverSwaps(retargeted, []).source).toBe('auto')
    })
})

describe('the turn-in selection', () => {
    it('chooses a train kind, which Undo clears', () => {
        let selection: TurnInSelection = stageTurnInKind({}, '2+1')
        expect(chosenTurnInKind(selection)).toBe('2+1')
        const undo = undoableStagedSelection<TurnInSelectionValues>(
            TurnInStageOrder,
            () => selection,
            (next) => (selection = next)
        )
        expect(undo.undo()).toBe(true)
        expect(chosenTurnInKind(selection)).toBeUndefined()
    })
})
