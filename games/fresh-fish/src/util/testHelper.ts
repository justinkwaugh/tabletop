import { Game, GameEngine, PlayerStatus, range } from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { v4 as uuid } from 'uuid'
import { FreshFishGameConfig } from '../definition/gameConfig.js'
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
        config: <FreshFishGameConfig>{
            numTurnsWithDisksToStart: 3
        }
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
