import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../definition.js'
import { DvonnRuntime } from '../runtime.js'
import { DvonnInfo } from '../info.js'
import type { DvonnVersion, WhitePlayer } from '../config.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import { HydratedDvonnGameState, type DvonnGameState } from '../../model/gameState.js'

export const engine = new GameEngine(DvonnRuntime)

export type DvonnConfig = { version?: DvonnVersion; whitePlayer?: WhitePlayer }

// `userIds` gives seats a user; the game's creator is the user `ownerId`.
export function createGame(
    config: DvonnConfig = {},
    playerIds: string[] = ['white', 'black'],
    owner: { ownerId: string; userIds: Record<string, string> } = { ownerId: 'owner', userIds: {} }
) {
    return DvonnRuntime.initializer.initializeGame(
        {
            id: 'dvonn-test',
            typeId: 'dvonn',
            ownerId: owner.ownerId,
            seed: 5,
            config: { ...defaultGameConfig(DvonnInfo.configurator?.options ?? []), ...config },
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

export type DvonnGame = ReturnType<typeof createGame>

let counter = 0
export function actionBase(game: DvonnGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

export function execute(game: DvonnGame, state: DvonnGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

// Every action the player to act may take.
export function legalActions(game: DvonnGame, state: DvonnGameState): GameAction[] {
    const hydrated = new HydratedDvonnGameState(state)
    const [playerId] = state.activePlayerIds
    if (state.machineState === MachineState.PlacingPieces) {
        return hydrated.board.vacantSpaces().map((coords) => ({
            ...actionBase(game, playerId),
            type: ActionType.PlacePiece,
            coords
        }))
    }
    return hydrated.movableStacks(playerId).flatMap((from) =>
        hydrated.board.destinationsFrom(from).map((to) => ({
            ...actionBase(game, playerId),
            type: ActionType.MoveStack,
            from,
            to
        }))
    )
}

// Plays legal actions chosen by a seeded generator until the game ends.
export function playToEnd(game: DvonnGame, state: DvonnGameState, seed: number): DvonnGameState {
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
        if (steps >= 200) throw Error('The playout did not end')
    }
    return state
}
