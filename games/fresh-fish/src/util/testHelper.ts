import {
    ActionSource,
    assertExists,
    defaultGameConfig,
    Game,
    GameConfig,
    GameEngine,
    normalizeGameConfig,
    PlayerStatus,
    range
} from '@tabletop/common'
import { FreshFishGameState, HydratedFreshFishGameState } from '../model/gameState.js'
import type { PlaceDisk } from '../actions/placeDisk.js'
import { CellType } from '../components/cells.js'
import { ActionType } from '../definition/actions.js'
import { FreshFishInfo } from '../definition/info.js'
import { FreshFishRuntime } from '../definition/runtime.js'
import { v4 as uuid } from 'uuid'
import { FreshFishGameConfigOptions, RuleSet } from '../definition/gameConfig.js'
import { Definition } from '../definition/gameDefinition.js'

export type TestStateConfig = {
    numPlayers?: number
}

export function generateTestState(config: TestStateConfig = {}): HydratedFreshFishGameState {
    const players = range(1, config.numPlayers ?? 3).map((playerNum) => ({
        id: `p${playerNum}`,
        name: `P${playerNum}`,
        isHuman: false,
        status: PlayerStatus.Joined
    }))

    const newGame = <Partial<Game>>{
        id: uuid(),
        typeId: 'freshfish',
        name: 'Test Game',
        players: players,
        ownerId: 'test',
        config: { ruleSet: RuleSet.Kyles }
    }

    const definition = Definition
    const runtime = definition.runtime
    const engine = new GameEngine(runtime)
    const game = runtime.initializer.initializeGame(newGame, definition)
    const state = runtime.initializer.initializeGameState(
        game,
        engine.generateUninitializedState(game)
    ) as HydratedFreshFishGameState
    return state
}

export function createTestGame(count: number, config: GameConfig = {}): Game {
    return FreshFishRuntime.initializer.initializeGame(
        {
            id: 'fresh-fish-test',
            typeId: FreshFishInfo.id,
            ownerId: 'owner',
            config: normalizeGameConfig({
                ...defaultGameConfig(FreshFishGameConfigOptions),
                ...config
            }),
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

export function firstEmptyCellDisk(
    game: Game,
    state: FreshFishGameState,
    playerId: string
): PlaceDisk {
    const hydrated = FreshFishRuntime.hydrator.hydrateState(state)
    const cell = [...hydrated.board].find(({ cell }) => cell.type === CellType.Empty)
    assertExists(cell, 'Expected an empty cell for a disk')
    return {
        id: `disk-${playerId}`,
        gameId: game.id,
        source: ActionSource.User,
        type: ActionType.PlaceDisk,
        playerId,
        coords: cell.coords
    }
}
