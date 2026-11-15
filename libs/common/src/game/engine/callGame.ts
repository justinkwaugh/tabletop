import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { nanoid } from 'nanoid'
import { type CallBallot, GameCall, GameCallKind } from '../model/gameCall.js'
import { STALLED_GAME_END_DAYS } from '../model/gameStall.js'
import { GameResult, validateGameResult } from '../model/gameResult.js'
import type { Game } from '../model/game.js'
import type { GameState } from '../model/gameState.js'
import { isTwoPlayerGame } from '../model/playerVote.js'
import { ActionSource, GameAction } from './gameAction.js'

export const CALL_GAME_ACTION_TYPE = 'callGame'

export type CallGameAction = Type.Static<typeof CallGameAction>
export const CallGameAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'source']),
        Type.Object({
            type: Type.Literal(CALL_GAME_ACTION_TYPE),
            source: Type.Literal(ActionSource.System),
            call: GameCall
        })
    ])
)

const CallGameActionValidator = Compile(CallGameAction)

export function isCallGameAction(action: GameAction): action is CallGameAction {
    return action.type === CALL_GAME_ACTION_TYPE && CallGameActionValidator.Check(action)
}

export function gameCallOf(action: GameAction | undefined): GameCall | undefined {
    return action !== undefined && isCallGameAction(action) ? action.call : undefined
}

/**
 * A copy of a game at a history position has no open vote, and keeps the call only when its
 * retained history ends with it.
 */
export function resetCopiedGameVoting(copy: Game, retainedActions: readonly GameAction[]): void {
    delete copy.vote
    const call = gameCallOf(retainedActions.at(-1))
    if (call) copy.call = call
    else delete copy.call
}

export function createCallGameAction({
    gameId,
    index,
    ballot,
    players
}: {
    gameId: string
    index?: number
    ballot: CallBallot
    players: readonly unknown[]
}): CallGameAction {
    const { initiatorPlayerId, declaredWinnerId, approvingPlayerIds, decliningPlayerIds } = ballot
    return callGameAction(gameId, index, {
        kind: isTwoPlayerGame(players) ? GameCallKind.Conceded : GameCallKind.Called,
        initiatorPlayerId,
        ...(declaredWinnerId === undefined ? {} : { declaredWinnerId }),
        approvingPlayerIds,
        decliningPlayerIds
    })
}

export function createStalledGameAction({
    gameId,
    index
}: {
    gameId: string
    index?: number
}): CallGameAction {
    return callGameAction(gameId, index, { kind: GameCallKind.Stalled })
}

function callGameAction(gameId: string, index: number | undefined, call: GameCall): CallGameAction {
    return {
        id: nanoid(),
        gameId,
        type: CALL_GAME_ACTION_TYPE,
        source: ActionSource.System,
        ...(index === undefined ? {} : { index }),
        call
    }
}

export function gameCallDescription(call: GameCall, nameOf: (playerId: string) => string): string {
    if (call.kind === GameCallKind.Stalled) {
        return `The game ended with no move in ${STALLED_GAME_END_DAYS} days`
    }
    const winnerId = call.declaredWinnerId
    const outcome = winnerId === undefined ? ' with no winner' : `; ${nameOf(winnerId)} wins`
    return call.kind === GameCallKind.Conceded
        ? `${nameOf(call.initiatorPlayerId)} conceded${outcome}`
        : `The game was called${outcome}`
}

export function callGameResult(call: GameCall): GameResult {
    return calledWinnerId(call) === undefined ? GameResult.Abandoned : GameResult.Win
}

function calledWinnerId(call: GameCall): string | undefined {
    return call.kind === GameCallKind.Stalled ? undefined : call.declaredWinnerId
}

export function applyCallGame<T extends GameState>(state: T, action: GameAction): T {
    if (action.playerId !== undefined || !isCallGameAction(action)) {
        throw Error('A callGame Action must be a System Action carrying the call')
    }
    const called = structuredClone(state)
    called.result = callGameResult(action.call)
    const winnerId = calledWinnerId(action.call)
    called.winningPlayerIds = winnerId === undefined ? [] : [winnerId]
    called.activePlayerIds = []
    validateGameResult(called)
    return called
}
