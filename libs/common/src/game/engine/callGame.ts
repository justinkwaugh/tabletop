import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { nanoid } from 'nanoid'
import { GameCall, GameCallKind } from '../model/gameCall.js'
import { GameResult, validateGameResult } from '../model/gameResult.js'
import type { GameState } from '../model/gameState.js'
import { isTwoPlayerGame, type CallVote } from '../model/playerVote.js'
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

export function gameCallOf(action: GameAction): GameCall | undefined {
    return isCallGameAction(action) ? action.call : undefined
}

export function createCallGameAction({
    gameId,
    index,
    vote,
    players
}: {
    gameId: string
    index?: number
    vote: Pick<
        CallVote,
        'initiatorPlayerId' | 'declaredWinnerId' | 'approvingPlayerIds' | 'decliningPlayerIds'
    >
    players: readonly unknown[]
}): CallGameAction {
    const call: GameCall = {
        kind: isTwoPlayerGame(players) ? GameCallKind.Conceded : GameCallKind.Called,
        initiatorPlayerId: vote.initiatorPlayerId,
        approvingPlayerIds: vote.approvingPlayerIds,
        decliningPlayerIds: vote.decliningPlayerIds
    }
    if (vote.declaredWinnerId !== undefined) call.declaredWinnerId = vote.declaredWinnerId
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
    const winnerId = call.declaredWinnerId
    const outcome = winnerId === undefined ? ' with no winner' : `; ${nameOf(winnerId)} wins`
    return call.kind === GameCallKind.Conceded
        ? `${nameOf(call.initiatorPlayerId)} conceded${outcome}`
        : `The game was called${outcome}`
}

export function callGameResult(call: Pick<GameCall, 'declaredWinnerId'>): GameResult {
    return call.declaredWinnerId === undefined ? GameResult.Abandoned : GameResult.Win
}

export function applyCallGame<T extends GameState>(state: T, action: GameAction): T {
    if (action.playerId !== undefined || !isCallGameAction(action)) {
        throw Error('A callGame Action must be a System Action carrying the call')
    }
    const called = structuredClone(state)
    called.result = callGameResult(action.call)
    called.winningPlayerIds =
        action.call.declaredWinnerId === undefined ? [] : [action.call.declaredWinnerId]
    called.activePlayerIds = []
    validateGameResult(called)
    return called
}
