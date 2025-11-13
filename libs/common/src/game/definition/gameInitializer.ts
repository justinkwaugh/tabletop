import { generateSeed } from '../../util/prng.js'
import { Game, GameCategory, GameStatus } from '../model/game.js'
import { GameState, HydratedGameState, UninitializedGameState } from '../model/gameState.js'
import { Value } from '@sinclair/typebox/value'

export interface GameInitializer {
    initializeGame(game: Partial<Game>): Game
    initializeGameState(game: Game, state: UninitializedGameState): HydratedGameState
    initializeExplorationState(state: GameState): GameState
}

export abstract class BaseGameInitializer implements GameInitializer {
    abstract initializeGameState(game: Game, state: UninitializedGameState): HydratedGameState
    abstract initializeExplorationState(state: GameState): GameState
    initializeGame(game: Partial<Game>): Game {
        const newGame: Game = <Game>{
            id: game.id,
            isPublic: game.isPublic,
            status: GameStatus.WaitingForPlayers,
            typeId: game.typeId,
            deleted: false,
            name: game.name?.trim() || 'Good Game',
            ownerId: game.ownerId,
            players: game.players,
            config: game.config ?? {},
            hotseat: game.hotseat ?? false,
            winningPlayerIds: [],
            seed: generateSeed(),
            activePlayerIds: [],
            createdAt: new Date(), // This will be updated by the db
            storage: game.storage ?? Game.Storage.Remote,
            parentId: game.parentId,
            category: game.category ?? GameCategory.Standard
        }

        if (!Value.Check(Game, newGame)) {
            throw Error(JSON.stringify([...Value.Errors(Game, newGame)]))
        }

        return newGame
    }
}
