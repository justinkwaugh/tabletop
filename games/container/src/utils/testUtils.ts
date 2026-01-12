import {
    ActionSource,
    createAction,
    GameCategory,
    GameStatus,
    GameStorage,
    MachineContext,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState,
    type GameConfig
} from '@tabletop/common'
import type { Static, TSchema } from 'typebox'
import { ContainerGameInitializer } from '../definition/initializer.js'
import type { ContainerGameConfig } from '../definition/config.js'
import type { HydratedContainerGameState } from '../model/gameState.js'

const initializer = new ContainerGameInitializer()
let actionCounter = 0

export function createTestGameState({
    playerCount = 3,
    useInvestmentBank = true
}: {
    playerCount?: 3 | 4 | 5
    useInvestmentBank?: boolean
} = {}): HydratedContainerGameState {
    const players: Player[] = Array.from({ length: playerCount }, (_, index) => ({
        id: `p${index + 1}`,
        isHuman: true,
        name: `Player ${index + 1}`,
        status: PlayerStatus.Joined,
        userId: `u${index + 1}`
    }))

    const gameConfig: ContainerGameConfig = { useInvestmentBank }

    const game: Game = {
        id: 'game-1',
        typeId: 'container',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'owner-1',
        name: 'Container Test',
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
    state: HydratedContainerGameState,
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

export function createMachineContext(
    state: HydratedContainerGameState,
    config: GameConfig = {}
) {
    return new MachineContext({
        gameConfig: config,
        gameState: state
    })
}
