import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../definition.js'
import { GipfRuntime } from '../runtime.js'
import { GipfInfo } from '../info.js'
import { GipfVersion } from '../config.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import { HydratedGipfGameState, type GipfGameState } from '../../model/gameState.js'

export const engine = new GameEngine(GipfRuntime)

export function createGame(
    version: GipfVersion = GipfVersion.Standard,
    playerIds: string[] = ['white', 'black']
) {
    return GipfRuntime.initializer.initializeGame(
        {
            id: 'gipf-test',
            typeId: 'gipf',
            ownerId: 'owner',
            seed: 5,
            config: { ...defaultGameConfig(GipfInfo.configurator?.options ?? []), version },
            players: playerIds.map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

export type GipfGame = ReturnType<typeof createGame>

let counter = 0
export function actionBase(game: GipfGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

export function execute(game: GipfGame, state: GipfGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

// Every action the player to act may take: each row they may remove, keeping their own
// GIPF-pieces, or else every push of each piece type they may bring in.
export function legalActions(game: GipfGame, state: GipfGameState): GameAction[] {
    const hydrated = new HydratedGipfGameState(state)
    const playerId = state.activePlayerIds[0]
    const { board } = hydrated
    if (state.machineState === MachineState.ResolvingRows) {
        const rows = board.rowsOf(playerId)
        const removals: GameAction[] = rows.map((row) => ({
            ...actionBase(game, playerId),
            type: ActionType.RemoveRow,
            from: row.from,
            to: row.to,
            keep: row.reach.filter(
                (coords) =>
                    board.pieceAt(coords)?.gipf && board.pieceAt(coords)?.playerId === playerId
            )
        }))
        const valid = removals.filter((action) => {
            try {
                execute(game, state, action)
                return true
            } catch {
                return false
            }
        })
        const mustRemove = rows.some((row) => board.isMandatory(row))
        return mustRemove
            ? valid
            : [...valid, { ...actionBase(game, playerId), type: ActionType.FinishRemoving }]
    }
    const pieceTypes = [
        ...(hydrated.canPlaySingle(playerId) ? [false] : []),
        ...(hydrated.canPlayGipf(playerId) ? [true] : [])
    ]
    return board.legalEntries().flatMap((entry) =>
        pieceTypes.map((isGipf) => ({
            ...actionBase(game, playerId),
            type: ActionType.PushPiece,
            dot: entry.dot,
            to: entry.line[0],
            gipf: isGipf
        }))
    )
}

// Plays legal actions chosen by a seeded generator until the game ends.
export function playToEnd(game: GipfGame, state: GipfGameState, seed: number): GipfGameState {
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
        if (steps >= 2000) throw Error('The playout did not end')
    }
    return state
}
