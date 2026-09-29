import { describe, expect, it } from 'vitest'
import type { GameAction } from './gameAction.js'
import { proveCommutation } from './commutation.js'
import { createNoteGame, noteGameRuntime, step, tally } from './tests/noteGame.js'

function raceAfterStep(late: GameAction) {
    const { engine, game, state } = createNoteGame()
    const recorded = engine.executeCanonicalAction({
        game,
        state,
        action: step('s1', game.id, 'p1', state.actionCount)
    })
    return proveCommutation({
        engine,
        apiActions: noteGameRuntime.apiActions,
        game,
        state: recorded.updatedState,
        raced: recorded.processedActions,
        late
    })
}

describe('Commutation Proof', () => {
    it('reconciles a sequenced Action whose effect does not depend on the order', () => {
        expect(raceAfterStep(tally('t1', 'note-game', 'p3', 0))).toEqual({ kind: 'commutes' })
    })

    it('rejects a sequenced Action whose effect depends on the order', () => {
        expect(raceAfterStep(tally('t1', 'note-game', 'p3', 0, { step: true }))).toEqual({
            kind: 'invalid',
            reason: 'the orders reach different Game States'
        })
    })

    it('reconciles a turn-taking Action that raced a sequenced one', () => {
        const { engine, game, state } = createNoteGame()
        const recorded = engine.executeCanonicalAction({
            game,
            state,
            action: tally('t1', game.id, 'p3', state.actionCount)
        })
        expect(
            proveCommutation({
                engine,
                apiActions: noteGameRuntime.apiActions,
                game,
                state: recorded.updatedState,
                raced: recorded.processedActions,
                late: step('s1', game.id, 'p1', 0)
            })
        ).toEqual({ kind: 'commutes' })
    })

    it('requires a sequenced Action on one side', () => {
        const { engine, game, state } = createNoteGame()
        const recorded = engine.executeCanonicalAction({
            game,
            state,
            action: step('s1', game.id, 'p1', state.actionCount)
        })
        expect(
            proveCommutation({
                engine,
                apiActions: noteGameRuntime.apiActions,
                game,
                state: recorded.updatedState,
                raced: recorded.processedActions,
                late: step('s2', game.id, 'p2', 0)
            })
        ).toMatchObject({ kind: 'invalid', reason: 'no sequenced out-of-turn Action is involved' })
    })

    it('rejects a race against the same Player’s own earlier Action', () => {
        expect(raceAfterStep(tally('t1', 'note-game', 'p1', 0))).toMatchObject({
            kind: 'invalid',
            reason: 'the Player already acted since that position'
        })
    })

    it('rejects a race involving an Information-Revealing Action', () => {
        expect(
            raceAfterStep({ ...tally('t1', 'note-game', 'p3', 0), revealsInfo: true })
        ).toMatchObject({
            kind: 'invalid',
            reason: 'an involved Action reveals information'
        })
    })
})
