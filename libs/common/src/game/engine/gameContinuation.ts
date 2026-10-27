import * as Type from 'typebox'
import { BaseError } from '../../util/errors.js'
import type { GameDefinition } from '../definition/gameDefinition.js'
import { GameCategory, type Game } from '../model/game.js'
import { GameState } from '../model/gameState.js'
import { Player } from '../model/player.js'
import { GameEngine } from './gameEngine.js'

export const GameContinuation = Type.Object({
    previousState: GameState,
    previousPlayers: Type.Array(Player)
})

export type GameContinuation<T extends GameState = GameState> = {
    readonly previousState: Readonly<T>
    readonly previousPlayers: readonly Player[]
}

export class GameContinuationError extends BaseError {
    constructor(message: string) {
        super({ name: 'GameContinuationError', message })
    }
}

export function assertContinuationAllowed(condition: unknown, message: string): asserts condition {
    if (!condition) throw new GameContinuationError(message)
}

export function captureGameContinuation(
    source: Game,
    state: GameState,
    definition: GameDefinition
): GameContinuation {
    assertContinuationAllowed(
        source.typeId === definition.info.id,
        'Continuation must use the same Game Title'
    )
    assertContinuationAllowed(
        !source.deleted && source.category !== GameCategory.Exploration,
        'Explorations and deleted games cannot be continued'
    )
    assertContinuationAllowed(
        definition.runtime.initializer.supportsContinuation === true,
        'This Game Title does not support continuation'
    )
    assertContinuationAllowed(
        state.result !== undefined && state.canContinue === true,
        'Game is not ready to continue'
    )
    return new GameEngine(definition.runtime).validateContinuation(source.id, {
        previousState: state,
        previousPlayers: source.players
    })
}
