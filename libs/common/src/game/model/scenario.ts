import { omitGameState, type Game } from './game.js'
import type { GameState } from './gameState.js'
import type { GameAction } from '../engine/gameAction.js'

/** A position saved to start from: a game with its state and the actions that led to it. */
export interface ScenarioData {
    game: Game
    state: GameState
    actions: GameAction[]
}

export function scenarioFromGame(
    game: Game & { state: GameState },
    actions: GameAction[]
): ScenarioData {
    return { game: omitGameState(game), state: game.state, actions }
}

export function scenarioJson(scenario: ScenarioData): string {
    return `${JSON.stringify(scenario, null, 1)}\n`
}
