import { Game } from '../model/game'
import { HydratedGameState } from '../model/gameState'

export interface GameInitializer {
    initializeGame(game: Partial<Game>): Game
    initializeGameState(game: Game): HydratedGameState
}
