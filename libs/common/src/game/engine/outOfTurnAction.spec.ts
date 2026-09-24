import { describe, expect, it } from 'vitest'
import { createNoteGame, note, step } from './tests/noteGame.js'

describe('Out-of-turn Actions', () => {
    it('accepts an Action from a Player who is not active', () => {
        const { engine, game, state } = createNoteGame()
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: note('n1', game.id, 'p3', 'pass for me')
        })
        expect(result.updatedState.notes).toEqual({ p3: 'pass for me' })
        expect(result.updatedState.activePlayerIds).toEqual(['p1'])
        expect(result.processedActions.map((action) => action.outOfTurn)).toEqual([true])
    })

    it('rejects the marker on an Action whose schema does not declare it', () => {
        const { engine, game, state } = createNoteGame()
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state,
                action: { ...step('s1', game.id, 'p2'), outOfTurn: true }
            })
        ).toThrow('not an out-of-turn Action')
    })

    it('offers a waiting Player only their out-of-turn Action types', () => {
        const { engine, game, state } = createNoteGame()
        expect(engine.getValidActionTypesForPlayer(game, state, 'p1')).toEqual(['step', 'note'])
        expect(engine.getValidActionTypesForPlayer(game, state, 'p3')).toEqual(['note'])
    })

    it('still rejects an ordinary Action from a Player who is not active', () => {
        const { engine, game, state } = createNoteGame()
        expect(() =>
            engine.executeCanonicalAction({ game, state, action: step('s1', game.id, 'p2') })
        ).toThrow('not an active player')
    })

    it('accepts an index behind the current count and reports the offset', () => {
        const { engine, game, state } = createNoteGame()
        const first = engine.executeCanonicalAction({
            game,
            state,
            action: step('s1', game.id, 'p1')
        })
        const second = engine.executeCanonicalAction({
            game,
            state: first.updatedState,
            action: step('s2', game.id, 'p2')
        })
        const stale = note('n1', game.id, 'p1', 'late', 1)
        const result = engine.executeCanonicalAction({
            game,
            state: second.updatedState,
            action: stale
        })
        expect(result.indexOffset).toBe(1)
        expect(result.updatedState.actionCount).toBe(3)
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state: second.updatedState,
                action: step('s3', game.id, 'p3', 1)
            })
        ).toThrow('Action index is not valid')
    })
})
