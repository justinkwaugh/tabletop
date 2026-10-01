import { GameStatus, GameStorage, PlayerStatus, type Game, type GameConfig } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'
import { OathGameInitializer } from '../definition/initializer.js'

export function testGame(playerIds: string[], overrides: Partial<Game> = {}): Game {
    return {
        id: 'game-1',
        typeId: 'oath',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: playerIds[0],
        name: 'Test Game',
        players: playerIds.map((id) => ({
            id,
            isHuman: true,
            name: id,
            status: PlayerStatus.Joined
        })),
        config: {},
        hotseat: true,
        createdAt: new Date(),
        winningPlayerIds: [],
        storage: GameStorage.Local,
        ...overrides
    }
}

export function seatIds(count: number): string[] {
    return Array.from({ length: count }, (_, i) => `p${i + 1}`)
}

/** R-1 */
export function waitingGame(playerCount: number, config: GameConfig = {}): Game {
    return testGame(seatIds(playerCount), { status: GameStatus.WaitingToStart, config })
}

/** R-1.2 to R-1.22 */
export function setUpState(
    playerCount: number,
    config: GameConfig = {},
    seed = 20260826
): HydratedOathGameState {
    return new OathGameInitializer().initializeGameState(waitingGame(playerCount, config), {
        id: 'state-1',
        gameId: 'game-1',
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed, invocations: 0 },
        winningPlayerIds: []
    })
}
