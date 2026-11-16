import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../definition.js'
import { YinshRuntime } from '../runtime.js'
import { YinshInfo } from '../info.js'
import { YinshVersion, type WhitePlayer } from '../config.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import { HydratedYinshGameState, type YinshGameState } from '../../model/gameState.js'
import { POINTS } from '../../model/geometry.js'

export const engine = new GameEngine(YinshRuntime)

export function createGame(
    version: YinshVersion = YinshVersion.Standard,
    playerIds: string[] = ['white', 'black'],
    options: {
        whitePlayer?: WhitePlayer
        ownerId?: string
        userIds?: Record<string, string>
    } = {}
) {
    return YinshRuntime.initializer.initializeGame(
        {
            id: 'yinsh-test',
            typeId: 'yinsh',
            ownerId: options.ownerId ?? 'owner',
            seed: 5,
            config: {
                ...defaultGameConfig(YinshInfo.configurator?.options ?? []),
                version,
                ...(options.whitePlayer === undefined ? {} : { whitePlayer: options.whitePlayer })
            },
            players: playerIds.map((id) => ({
                id,
                name: id,
                userId: options.userIds?.[id],
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

export type YinshGame = ReturnType<typeof createGame>

let counter = 0
export function actionBase(game: YinshGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

export function execute(game: YinshGame, state: YinshGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

// Every action the player to act may take.
export function legalActions(game: YinshGame, state: YinshGameState): GameAction[] {
    const hydrated = new HydratedYinshGameState(state)
    const playerId = state.activePlayerIds[0]
    switch (state.machineState) {
        case MachineState.PlacingRings:
            return POINTS.filter((coords) => hydrated.board.isVacant(coords)).map((coords) => ({
                ...actionBase(game, playerId),
                type: ActionType.PlaceRing,
                coords
            }))
        case MachineState.MovingRing:
            return hydrated.movesFor(playerId).flatMap((ring) =>
                ring.moves.map((move) => ({
                    ...actionBase(game, playerId),
                    type: ActionType.MoveRing,
                    from: ring.from,
                    to: move.to
                }))
            )
        case MachineState.RemovingRow:
            return hydrated.board.rowsOf(playerId).map((row) => ({
                ...actionBase(game, playerId),
                type: ActionType.RemoveRow,
                from: row[0],
                to: row[row.length - 1]
            }))
        case MachineState.RemovingRing:
            return hydrated.board.ringsOf(playerId).map((coords) => ({
                ...actionBase(game, playerId),
                type: ActionType.RemoveRing,
                coords
            }))
        default:
            return []
    }
}

// Plays legal actions chosen by a seeded generator until the game ends.
export function playToEnd(game: YinshGame, state: YinshGameState, seed: number): YinshGameState {
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
        if (steps >= 1000) throw Error('The playout did not end')
    }
    return state
}
