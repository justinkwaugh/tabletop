import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../definition.js'
import { YRuntime } from '../runtime.js'
import { YInfo } from '../info.js'
import type { BlackPlayer } from '../config.js'
import type { BoardShape } from '../../model/boardShape.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import { HydratedYGameState, type YGameState } from '../../model/gameState.js'

export const engine = new GameEngine(YRuntime)

export const MASTER_SEED = '0123456789abcdef0123456789abcdef'

export type YConfig = { board?: BoardShape; swapRule?: boolean; blackPlayer?: BlackPlayer }

// `userIds` gives seats a user; the game's creator is the user `ownerId`.
export function createGame(
    config: YConfig = {},
    playerIds: string[] = ['black', 'white'],
    owner: { ownerId: string; userIds: Record<string, string> } = { ownerId: 'owner', userIds: {} }
) {
    return YRuntime.initializer.initializeGame(
        {
            id: 'game-of-y-test',
            typeId: 'game-of-y',
            ownerId: owner.ownerId,
            seed: 5,
            config: { ...defaultGameConfig(YInfo.configurator?.options ?? []), ...config },
            players: playerIds.map((id) => ({
                id,
                name: id,
                userId: owner.userIds[id],
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

export type YGame = ReturnType<typeof createGame>

let counter = 0
export function actionBase(game: YGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

export function execute(game: YGame, state: YGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

// Every action the player to act may take.
export function legalActions(game: YGame, state: YGameState): GameAction[] {
    const hydrated = new HydratedYGameState(state)
    const [playerId] = state.activePlayerIds
    const placements: GameAction[] = hydrated.board.vacantPoints().map((point) => ({
        ...actionBase(game, playerId),
        type: ActionType.PlaceStone,
        point
    }))
    return game.config.swapRule === true && hydrated.swapIsOpen()
        ? [...placements, { ...actionBase(game, playerId), type: ActionType.SwapColors }]
        : placements
}

// Plays legal actions chosen by a seeded generator until the game ends.
export function playToEnd(game: YGame, state: YGameState, seed: number): YGameState {
    let value = seed + 1
    const choose = <T>(options: T[]): T => {
        value = (value * 1103515245 + 12345) % 2147483648
        return options[value % options.length]
    }
    let steps = 0
    while (state.machineState !== MachineState.EndOfGame) {
        const actions = legalActions(game, state)
        if (actions.length === 0) throw Error(`No legal action after ${steps} steps`)
        state = execute(game, state, choose(actions))
        steps += 1
        // Every place filled, and a swap.
        if (steps > hydratedBoardSize(state) + 1) throw Error('The playout did not end')
    }
    return state
}

function hydratedBoardSize(state: YGameState): number {
    return new HydratedYGameState(state).board.grid.points.length
}
