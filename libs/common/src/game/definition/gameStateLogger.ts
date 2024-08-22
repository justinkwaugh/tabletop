import { GameState } from '../model/gameState.js'

export interface GameStateLogger {
    logState(state: GameState): void
}

export class DefaultStateLogger implements GameStateLogger {
    logState(state: GameState) {
        console.log(state)
    }
}
