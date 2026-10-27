import * as Type from 'typebox'
import { BaseError } from '../../util/errors.js'
import { GameState } from '../model/gameState.js'
import { Player } from '../model/player.js'

export const GameContinuation = Type.Object({
    previousState: GameState,
    previousPlayers: Type.Array(Player)
})

export type GameContinuation<T extends GameState = GameState> = {
    readonly previousState: Readonly<T>
    readonly previousPlayers: readonly Player[]
}

export class GameContinuationError extends BaseError {
    constructor(message: string, cause?: Error) {
        super({ name: 'GameContinuationError', message, cause })
    }
}

export function assertContinuationAllowed(condition: unknown, message: string): asserts condition {
    if (!condition) throw new GameContinuationError(message)
}
