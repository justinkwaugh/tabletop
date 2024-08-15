import { GameState } from '../game/model/gameState.js'

export interface StateLogger {
    logState(state: GameState): void
}
