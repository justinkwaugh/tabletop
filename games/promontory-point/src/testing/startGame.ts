import {
    GameEngine,
    PlayerStatus,
    assert,
    type Game,
    type GameConfig,
    type StartingPositionAssignment
} from '@tabletop/common'
import { Definition } from '../definition/definition.js'
import {
    PromontoryPointGameStateValidator,
    type PromontoryPointGameState,
    type PromontoryPointProjectedState
} from '../model/gameState.js'

export const VARIANT_OFF_AND_ON: GameConfig[] = [{}, { fourPieceVariant: true }]
export const VARIANT_OFF: GameConfig[] = [{}, { fourPieceVariant: false }]

// R-6.3-H1: the table option on or off.
export function variantConfig(fourPieceVariant: boolean): GameConfig {
    return { fourPieceVariant }
}

export const TEST_MASTER_SEED = '0123456789abcdef0123456789abcdef'

export const engine = new GameEngine(Definition.runtime)

export function playerIds(playerCount: number): string[] {
    return Array.from({ length: playerCount }, (_, index) => `p${index + 1}`)
}

export function createGame(playerCount = 4, config: GameConfig = {}): Game {
    return Definition.runtime.initializer.initializeGame(
        {
            id: `promontory-point-${playerCount}`,
            typeId: Definition.info.id,
            ownerId: 'p1',
            config,
            players: playerIds(playerCount).map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

export function startGame(
    options: {
        playerCount?: number
        config?: GameConfig
        masterSeed?: string
        startingPositions?: StartingPositionAssignment
    } = {}
): { game: Game; state: PromontoryPointGameState } {
    const game = createGame(options.playerCount, options.config)
    const { startedGame, initialState } = engine.startGame(game, {
        masterSeed: options.masterSeed ?? TEST_MASTER_SEED,
        startingPositions: options.startingPositions
    })
    return { game: startedGame, state: canonical(initialState) }
}

export function canonical(state: PromontoryPointProjectedState): PromontoryPointGameState {
    assert(PromontoryPointGameStateValidator.Check(state), 'Expected complete canonical state')
    return state
}
