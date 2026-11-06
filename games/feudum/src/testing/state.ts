import {
    GameCategory,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { FeudumGameInitializer } from '../definition/initializer.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'

/** A game as initialization leaves it, for specs. */
export function initialState(numPlayers = 4, seed = 123): HydratedFeudumGameState {
    const players = Array.from({ length: numPlayers }, (_, index): Player => ({
        id: `p${index + 1}`,
        isHuman: true,
        userId: `u${index + 1}`,
        name: `Player ${index + 1}`,
        status: PlayerStatus.Joined
    }))
    const game: Game = {
        id: 'game-1',
        typeId: 'feudum',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'u1',
        name: 'Feudum Test',
        players,
        config: {},
        hotseat: false,
        winningPlayerIds: [],
        seed,
        createdAt: new Date(0),
        storage: GameStorage.Local,
        category: GameCategory.Standard
    }
    const state: UninitializedGameState = {
        id: 'state-1',
        gameId: game.id,
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed, invocations: 0 },
        winningPlayerIds: []
    }
    return new FeudumGameInitializer().initializeGameState(game, state)
}
