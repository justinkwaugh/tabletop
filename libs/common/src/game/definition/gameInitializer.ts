import { generateSeed } from '../../util/prng.js'
import { Game, GameCategory, GameStatus, GameStorage } from '../model/game.js'
import type { GameState, HydratedGameState, UninitializedGameState } from '../model/gameState.js'
import * as Value from 'typebox/value'
import type { GameDefinition } from './gameDefinition.js'
import { assertExists } from '../../util/assertions.js'

export interface GameInitializer<
    T extends GameState = GameState,
    U extends HydratedGameState<T> = HydratedGameState<T>
> {
    initializeGame(game: Partial<Game>, definition: GameDefinition<T, U>): Game
    initializeGameState(game: Game, state: UninitializedGameState): U
    initializeExplorationState(state: T): T
}

export abstract class BaseGameInitializer<
    T extends GameState = GameState,
    U extends HydratedGameState<T> = HydratedGameState<T>
> implements GameInitializer<T, U>
{
    abstract initializeGameState(game: Game, state: UninitializedGameState): U
    abstract initializeExplorationState(state: T): T

    initializeGame(game: Partial<Game>, definition: GameDefinition<T, U>): Game {
        if (Object.keys(game.config ?? {}).length > 0) {
            assertExists(
                definition.info.configurator,
                'Config handler is required to validate game config'
            )
            definition.info.configurator.validateConfig(game.config!)
        }

        const newGame: Game = <Game>{
            id: game.id,
            isPublic: game.isPublic || false,
            status: GameStatus.WaitingForPlayers,
            typeId: game.typeId,
            deleted: false,
            name: game.name?.trim() || 'Good Game',
            ownerId: game.ownerId,
            players: game.players,
            config: game.config ?? {},
            hotseat: game.hotseat ?? false,
            winningPlayerIds: [],
            seed: game.seed ?? generateSeed(),
            activePlayerIds: [],
            createdAt: new Date(), // This will be updated by the db
            storage: game.storage ?? GameStorage.Remote,
            parentId: game.parentId,
            category: game.category ?? GameCategory.Standard
        }

        if (!Value.Check(Game, newGame)) {
            throw Error(JSON.stringify(Value.Errors(Game, newGame)))
        }

        return newGame
    }
}
