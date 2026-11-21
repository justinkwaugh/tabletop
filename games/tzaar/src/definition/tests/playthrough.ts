import {
    ActionSource,
    Color,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../definition.js'
import { TzaarRuntime } from '../runtime.js'
import { TzaarInfo } from '../info.js'
import type { TzaarVersion, FirstPlayer } from '../config.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import { HydratedTzaarGameState, type TzaarGameState } from '../../model/gameState.js'

export const engine = new GameEngine(TzaarRuntime)

// A fixed master seed, so the random start is the same on every run.
export const MASTER_SEED = '0123456789abcdef0123456789abcdef'

export type TzaarConfig = { version?: TzaarVersion; whitePlayer?: FirstPlayer }

// `userIds` gives seats a user; the game's creator is the user `ownerId`.
export function createGame(
    config: TzaarConfig = {},
    playerIds: string[] = ['white', 'black'],
    owner: { ownerId: string; userIds: Record<string, string> } = { ownerId: 'owner', userIds: {} }
) {
    return TzaarRuntime.initializer.initializeGame(
        {
            id: 'tzaar-test',
            typeId: 'tzaar',
            ownerId: owner.ownerId,
            seed: 5,
            config: { ...defaultGameConfig(TzaarInfo.configurator?.options ?? []), ...config },
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

export type TzaarGame = ReturnType<typeof createGame>

let counter = 0
export function actionBase(game: TzaarGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

export function execute(game: TzaarGame, state: TzaarGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

// Every action the player to act may take.
export function legalActions(game: TzaarGame, state: TzaarGameState): GameAction[] {
    const hydrated = new HydratedTzaarGameState(state)
    const [playerId] = state.activePlayerIds
    if (state.machineState === MachineState.ChoosingColor) {
        return [Color.White, Color.Black].map((color) => ({
            ...actionBase(game, playerId),
            type: ActionType.ChooseColor,
            color
        }))
    }
    if (state.machineState === MachineState.PlacingPieces) {
        return hydrated.board.vacantSpaces().flatMap((coords) =>
            hydrated.kindsInHand(hydrated.ownerOfNextPiece()).map((kind) => ({
                ...actionBase(game, playerId),
                type: ActionType.PlacePiece,
                coords,
                kind
            }))
        )
    }
    const captures = hydrated.captures(playerId).map(({ from, to }) => ({
        ...actionBase(game, playerId),
        type: ActionType.Capture,
        from,
        to
    }))
    if (state.machineState === MachineState.Capturing) {
        return captures
    }
    const stackings = hydrated.stackings(playerId).map(({ from, to }) => ({
        ...actionBase(game, playerId),
        type: ActionType.Stack,
        from,
        to
    }))
    return [...captures, ...stackings, { ...actionBase(game, playerId), type: ActionType.Pass }]
}

// Plays legal actions chosen by a seeded generator until the game ends.
export function playToEnd(game: TzaarGame, state: TzaarGameState, seed: number): TzaarGameState {
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
        if (steps >= 400) throw Error('The playout did not end')
    }
    return state
}
