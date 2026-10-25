import { describe, expect, it } from 'vitest'
import { GameCallKind, type GameCall } from '../model/gameCall.js'
import { GameResult } from '../model/gameResult.js'
import {
    CALL_GAME_ACTION_TYPE,
    createCallGameAction,
    gameCallDescription,
    gameCallOf,
    type CallGameAction
} from './callGame.js'
import { ActionSource } from './gameAction.js'
import { undoRecordedAction } from './recordedHistory.js'
import { createNoteGame, step } from './tests/noteGame.js'

function withoutWinner(action: CallGameAction): CallGameAction {
    delete action.call.declaredWinnerId
    return action
}

function callGame(gameId: string, call: Partial<GameCall> = {}): CallGameAction {
    return {
        id: 'call',
        gameId,
        type: CALL_GAME_ACTION_TYPE,
        source: ActionSource.System,
        call: {
            kind: GameCallKind.Called,
            initiatorPlayerId: 'p1',
            declaredWinnerId: 'p2',
            approvingPlayerIds: ['p1', 'p2'],
            decliningPlayerIds: [],
            ...call
        }
    }
}

describe('callGame', () => {
    it('ends the game with the declared winner and leaves machine state alone', () => {
        const { engine, game, state } = createNoteGame()
        const { processedActions, updatedState } = engine.executeCanonicalAction({
            action: callGame(game.id),
            state,
            game
        })
        expect(updatedState.result).toBe(GameResult.Win)
        expect(updatedState.winningPlayerIds).toEqual(['p2'])
        expect(updatedState.activePlayerIds).toEqual([])
        expect(updatedState.machineState).toBe(state.machineState)
        expect(updatedState.actionCount).toBe(state.actionCount + 1)
        expect(processedActions).toHaveLength(1)
        expect(processedActions[0].index).toBe(state.actionCount)
        expect(undoRecordedAction(updatedState, processedActions[0])).toEqual(state)
    })

    it('abandons the game when nobody is declared the winner', () => {
        const { engine, game, state } = createNoteGame()
        const { updatedState } = engine.executeCanonicalAction({
            action: withoutWinner(callGame(game.id)),
            state,
            game
        })
        expect(updatedState.result).toBe(GameResult.Abandoned)
        expect(updatedState.winningPlayerIds).toEqual([])
    })

    it('refuses a winner who is not a player and Actions from a player', () => {
        const { engine, game, state } = createNoteGame()
        expect(() =>
            engine.executeCanonicalAction({
                action: callGame(game.id, { declaredWinnerId: 'stranger' }),
                state,
                game
            })
        ).toThrow()
        expect(() =>
            engine.executeCanonicalAction({
                action: { ...callGame(game.id), playerId: 'p1' },
                state,
                game
            })
        ).toThrow()
    })

    it('accepts no further Actions once called', () => {
        const { engine, game, state } = createNoteGame()
        const called = engine.executeCanonicalAction({
            action: callGame(game.id),
            state,
            game
        }).updatedState
        expect(engine.getValidActionTypesForPlayer(game, called, 'p1')).toEqual([])
        expect(() =>
            engine.executeCanonicalAction({
                action: step('s', game.id, 'p1'),
                state: called,
                game
            })
        ).toThrow('A Game State with a result accepts no further Actions')
    })
})

describe('gameCallDescription', () => {
    const nameOf = (playerId: string) => playerId.toUpperCase()
    const call = (overrides: Partial<GameCall>, winner = true): GameCall => {
        const built = callGame('g', overrides)
        const action = gameCallOf(winner ? built : withoutWinner(built))
        if (!action) throw Error('Expected a call')
        return action
    }

    it('describes a concession, a call with a winner and one without', () => {
        expect(
            gameCallDescription(
                call({ kind: GameCallKind.Conceded, declaredWinnerId: 'p2' }),
                nameOf
            )
        ).toBe('P1 conceded; P2 wins')
        expect(gameCallDescription(call({ declaredWinnerId: 'p3' }), nameOf)).toBe(
            'The game was called; P3 wins'
        )
        expect(gameCallDescription(call({}, false), nameOf)).toBe(
            'The game was called with no winner'
        )
    })
})

describe('createCallGameAction', () => {
    const vote = { initiatorPlayerId: 'p1', approvingPlayerIds: ['p1'], decliningPlayerIds: [] }

    it('records a two-player call as a concession', () => {
        const action = createCallGameAction({
            gameId: 'g',
            vote: { ...vote, declaredWinnerId: 'p2' },
            players: ['p1', 'p2']
        })
        expect(action.call).toEqual({
            ...vote,
            kind: GameCallKind.Conceded,
            declaredWinnerId: 'p2'
        })
        expect(gameCallOf(action)).toBe(action.call)
    })

    it('leaves the winner out of a call with no winner', () => {
        const action = createCallGameAction({
            gameId: 'g',
            index: 4,
            vote,
            players: ['p1', 'p2', 'p3']
        })
        expect(action.index).toBe(4)
        expect(action.call.kind).toBe(GameCallKind.Called)
        expect('declaredWinnerId' in action.call).toBe(false)
    })
})
