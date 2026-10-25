import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameCall, GameCallKind } from '../model/gameCall.js'
import { GameResult, validateGameResult } from '../model/gameResult.js'
import type { GameState } from '../model/gameState.js'
import { ActionSource, GameAction } from './gameAction.js'

export const CALL_GAME_ACTION_TYPE = 'callGame'

export type CallGameAction = Type.Static<typeof CallGameAction>
export const CallGameAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'source', 'playerId']),
        Type.Object({
            type: Type.Literal(CALL_GAME_ACTION_TYPE),
            source: Type.Literal(ActionSource.System),
            call: GameCall
        })
    ])
)

const CallGameActionValidator = Compile(CallGameAction)

export function isCallGameAction(action: Pick<GameAction, 'type'>): boolean {
    return action.type === CALL_GAME_ACTION_TYPE
}

export function gameCallOf(action: GameAction): GameCall | undefined {
    return CallGameActionValidator.Check(action) ? action.call : undefined
}

export function gameCallDescription(call: GameCall, nameOf: (playerId: string) => string): string {
    const winners = nameList(call.declaredWinnerIds.map(nameOf))
    const verb = call.declaredWinnerIds.length === 1 ? 'wins' : 'win'
    if (call.kind === GameCallKind.Conceded) {
        return `${nameOf(call.initiatorPlayerId)} conceded; ${winners} ${verb}`
    }
    return call.declaredWinnerIds.length === 0
        ? 'The game was called with no winner'
        : `The game was called; ${winners} ${verb}`
}

export function nameList(names: readonly string[]): string {
    return names.length <= 1
        ? (names[0] ?? '')
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function callGameResult(call: Pick<GameCall, 'declaredWinnerIds'>): GameResult {
    return call.declaredWinnerIds.length > 0 ? GameResult.Win : GameResult.Abandoned
}

export function applyCallGame<T extends GameState>(state: T, action: GameAction): T {
    if (action.playerId !== undefined || !CallGameActionValidator.Check(action)) {
        throw Error('A callGame Action must be a System Action carrying the call')
    }
    const called = structuredClone(state)
    called.result = callGameResult(action.call)
    called.winningPlayerIds = [...action.call.declaredWinnerIds]
    called.activePlayerIds = []
    validateGameResult(called)
    return called
}
