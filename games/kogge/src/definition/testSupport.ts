import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assertExists,
    type Game,
    type GameAction
} from '@tabletop/common'
import { KoggeGameStateValidator, type KoggeGameState } from '../model/gameState.js'
import { ActionType } from './actions.js'
import { Definition } from './definition.js'
import { KoggeRuntime } from './runtime.js'

export const engine = new GameEngine(KoggeRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

export interface Table {
    game: Game
    state: KoggeGameState
}

export function newTable(count: number): Table {
    const game = KoggeRuntime.initializer.initializeGame(
        {
            id: 'kogge-test',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 7,
            config: {},
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { startedGame, initialState } = engine.startGame(game, { masterSeed })
    return { game: startedGame, state: canonical(initialState) }
}

export function canonical(state: unknown): KoggeGameState {
    if (!KoggeGameStateValidator.Check(state)) {
        throw new Error('Expected complete canonical state')
    }
    return state
}

let actionCounter = 0

export function play(table: Table, playerId: string, action: Record<string, unknown>) {
    const type = action.type
    assertExists(type, 'An action needs a type')
    const full: GameAction = {
        id: `t${actionCounter++}`,
        gameId: table.game.id,
        source: ActionSource.User,
        playerId,
        type: String(type),
        ...action
    }
    const result = engine.executeCanonicalAction({
        game: table.game,
        state: table.state,
        action: full
    })
    table.state = canonical(result.updatedState)
    return result.processedActions
}

export function chooseStarts(table: Table, cities: number[]) {
    cities.forEach((city, index) => {
        play(table, `p${index}`, { type: ActionType.ChooseStartCity, city })
    })
}

export function edit(table: Table, change: (state: KoggeGameState) => void) {
    const state = structuredClone(table.state)
    change(state)
    table.state = canonical(state)
}

export function hydrated(table: Table) {
    return KoggeRuntime.hydrator.hydrateState(table.state)
}
