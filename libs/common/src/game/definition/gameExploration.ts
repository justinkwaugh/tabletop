import type { Game } from '../model/game.js'
import type { GameState } from '../model/gameState.js'
import type { GameAction } from '../engine/gameAction.js'
import type { Perspective } from '../visibility/valueProjector.js'
import type { RandomFunction } from '../../util/prng.js'

export interface ExplorationPopulation<T extends GameState> {
    game: Game
    state: T
    actions: readonly GameAction[]
    perspective: Perspective
    random: RandomFunction
}

export interface GameExploration<T extends GameState = GameState> {
    createFromCanonicalState(state: T): T
    createFromProjectedState?(input: ExplorationPopulation<T>): T
}
