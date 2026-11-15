import {
    ActionSource,
    createAction,
    GameCategory,
    GameEngine,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type Player
} from '@tabletop/common'
import type { Static, TSchema } from 'typebox'
import { SolRuntime } from '../definition/runtime.js'
import type { SolGameConfig } from '../definition/gameConfig.js'
import type { HydratedSolGameState } from '../model/gameState.js'

const engine = new GameEngine(SolRuntime)
let actionCounter = 0

export function createTestGameState(): HydratedSolGameState {
    const players: Player[] = ['p1', 'p2', 'p3'].map((id, index) => ({
        id,
        isHuman: true,
        name: `Player ${index + 1}`,
        status: PlayerStatus.Joined,
        userId: `u${index + 1}`
    }))

    const gameConfig: SolGameConfig = {
        lowConflict: false,
        noBlue: false,
        noGreen: false,
        noYellow: false
    }

    const game: Game = {
        id: 'game-1',
        typeId: 'sol',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'owner-1',
        name: 'Sol Test',
        players,
        config: gameConfig,
        hotseat: false,
        winningPlayerIds: [],
        seed: 123,
        createdAt: new Date(),
        storage: GameStorage.Local,
        category: GameCategory.Standard
    }

    return SolRuntime.initializer.initializeGameState(game, engine.generateUninitializedState(game))
}

export function createActionBase<T extends TSchema>(
    schema: T,
    state: HydratedSolGameState,
    data: Partial<Static<T>> = {}
): Static<T> {
    actionCounter += 1
    return createAction(schema, {
        id: `action-${actionCounter}`,
        gameId: state.gameId,
        source: ActionSource.User,
        ...data
    })
}
