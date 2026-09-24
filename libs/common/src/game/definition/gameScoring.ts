import type { GameState } from '../model/gameState.js'

export interface GameScoring<T extends GameState = GameState> {
    finalScores(state: T): Record<string, number>
}
