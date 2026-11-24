import {
    assert,
    assertExists,
    GameCategory,
    GameStatus,
    GameStorage,
    MachineContext,
    PlayerStatus,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { EpochTrack, MilitaryServiceTrack, type Epoch, type SunrayId } from '../data/tracks.js'
import { FeudumGameInitializer } from '../definition/initializer.js'
import { ChoosingStartingGoodsStateHandler } from '../stateHandlers/choosingStartingGoods.js'
import {
    FeudumGameStateValidator,
    type FeudumGameState,
    type HydratedFeudumGameState
} from '../model/gameState.js'

export function testGame(numPlayers = 4, seed = 123): Game {
    const players = Array.from({ length: numPlayers }, (_, index): Player => ({
        id: `p${index + 1}`,
        isHuman: true,
        userId: `u${index + 1}`,
        name: `Player ${index + 1}`,
        status: PlayerStatus.Joined
    }))
    return {
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
}

export function initialState(numPlayers = 4, seed = 123): HydratedFeudumGameState {
    const game = testGame(numPlayers, seed)
    const state: UninitializedGameState = {
        systemVersion: 3,
        id: 'state-1',
        gameId: game.id,
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed, invocations: 0 },
        protectedPrng: { seed: seed + 1, invocations: 0 },
        winningPlayerIds: []
    }
    const gameState = new FeudumGameInitializer().initializeGameState(game, state)
    new ChoosingStartingGoodsStateHandler().enter(
        new MachineContext({ gameConfig: game.config, gameState })
    )
    return gameState
}

export function canonicalOf(state: HydratedFeudumGameState): FeudumGameState {
    const data = state.dehydrate()
    assert(FeudumGameStateValidator.Check(data), 'A host-side state is complete')
    return data
}

/** R-4.9-H2 */
export function coverService(
    state: Pick<FeudumGameState, 'militaryService'>,
    playerId: string,
    covered: number
): void {
    const furthest = MilitaryServiceTrack[covered - 1]
    if (furthest) {
        state.militaryService[playerId] = furthest.id
    } else {
        delete state.militaryService[playerId]
    }
}

export function canonicalState(numPlayers = 4, seed = 123): FeudumGameState {
    return canonicalOf(initialState(numPlayers, seed))
}

/** R-2.1 The sunray printed with this epoch's number, for a spec that names the epoch. */
export function epochAt(epoch: Epoch): SunrayId {
    const ray = EpochTrack.find((candidate) => candidate.epoch === epoch)
    assertExists(ray, `No sunray for epoch ${epoch}`)
    return ray.id
}
