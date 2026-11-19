import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../definition.js'
import { HexRuntime } from '../runtime.js'
import { HexInfo } from '../info.js'
import type { RedPlayer } from '../config.js'
import type { BoardSize } from '../../model/boardSize.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import { HydratedHexGameState, type HexGameState } from '../../model/gameState.js'

export const engine = new GameEngine(HexRuntime)

export const MASTER_SEED = '0123456789abcdef0123456789abcdef'

export type HexConfig = { size?: BoardSize; swapRule?: boolean; redPlayer?: RedPlayer }

// `userIds` gives seats a user; the game's creator is the user `ownerId`.
export function createGame(
    config: HexConfig = {},
    playerIds: string[] = ['red', 'blue'],
    owner: { ownerId: string; userIds: Record<string, string> } = { ownerId: 'owner', userIds: {} }
) {
    return HexRuntime.initializer.initializeGame(
        {
            id: 'hex-test',
            typeId: 'hex',
            ownerId: owner.ownerId,
            seed: 5,
            config: { ...defaultGameConfig(HexInfo.configurator?.options ?? []), ...config },
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

export type HexGame = ReturnType<typeof createGame>

let counter = 0
export function actionBase(game: HexGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

export function execute(game: HexGame, state: HexGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

// Every action the player to act may take.
export function legalActions(game: HexGame, state: HexGameState): GameAction[] {
    const hydrated = new HydratedHexGameState(state)
    const [playerId] = state.activePlayerIds
    const placements: GameAction[] = hydrated.board.vacantCells().map((cell) => ({
        ...actionBase(game, playerId),
        type: ActionType.PlaceStone,
        cell
    }))
    return game.config.swapRule === true && hydrated.swapIsOpen()
        ? [...placements, { ...actionBase(game, playerId), type: ActionType.SwapColors }]
        : placements
}

// Plays legal actions chosen by a seeded generator until the game ends.
export function playToEnd(game: HexGame, state: HexGameState, seed: number): HexGameState {
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

function hydratedBoardSize(state: HexGameState): number {
    return new HydratedHexGameState(state).board.grid.cells.length
}
