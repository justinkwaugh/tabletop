import {
    ActionSource,
    createAction,
    GameCategory,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import type { Static, TSchema } from 'typebox'
import { SolGameInitializer } from '../definition/gameInitializer.js'
import type { SolGameConfig } from '../definition/gameConfig.js'
import type { HydratedSolGameState } from '../model/gameState.js'

const initializer = new SolGameInitializer()
let actionCounter = 0

export function createTestGameState({
    playerCount = 3
}: {
    playerCount?: 2 | 3 | 4 | 5
} = {}): HydratedSolGameState {
    const players: Player[] = Array.from({ length: playerCount }, (_, index) => ({
        id: `p${index + 1}`,
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

    const state: UninitializedGameState = {
        id: 'state-1',
        gameId: game.id,
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 42, invocations: 0 },
        winningPlayerIds: []
    }

    return initializer.initializeGameState(game, state)
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
