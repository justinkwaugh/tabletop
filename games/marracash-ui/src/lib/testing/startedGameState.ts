import { defaultGameConfig, GameEngine, normalizeGameConfig, PlayerStatus } from '@tabletop/common'
import {
    Definition,
    MarracashInfo,
    MarracashRuntime,
    type HydratedMarracashGameState
} from '@tabletop/marracash'

// A game just started with the default options, players p0, p1, ... and a fixed seed.
export function startedGameState(gameId: string, playerCount: number): HydratedMarracashGameState {
    const game = MarracashRuntime.initializer.initializeGame(
        {
            id: gameId,
            typeId: MarracashInfo.id,
            ownerId: 'p0',
            config: normalizeGameConfig(
                defaultGameConfig(MarracashInfo.configurator?.options ?? [])
            ),
            players: Array.from({ length: playerCount }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { initialState } = new GameEngine(MarracashRuntime).startGame(game, {
        masterSeed: '0123456789abcdef0123456789abcdef'
    })
    return MarracashRuntime.hydrator.hydrateState(initialState)
}
