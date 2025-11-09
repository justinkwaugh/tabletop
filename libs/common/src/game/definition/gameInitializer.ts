import { generateSeed } from '../../util/prng.js'
import { Game, GameStatus } from '../model/game.js'
import { HydratedGameState, UninitializedGameState } from '../model/gameState.js'
import { Value } from '@sinclair/typebox/value'

export interface GameInitializer {
    initializeGame(game: Partial<Game>): Game
    initializeGameState(game: Game, state: UninitializedGameState): HydratedGameState
}

export abstract class BaseGameInitializer implements GameInitializer {
    abstract initializeGameState(game: Game, state: UninitializedGameState): HydratedGameState
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
            createdAt: new Date() // This will be updated by the db
        }

        if (!Value.Check(Game, newGame)) {
            throw Error(JSON.stringify([...Value.Errors(Game, newGame)]))
        }

        return newGame
    }
}
