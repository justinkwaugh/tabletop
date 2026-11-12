import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../definition.js'
import { MatrxRuntime } from '../runtime.js'
import { MatrxInfo } from '../info.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import { HydratedMatrxGameState, type MatrxGameState } from '../../model/gameState.js'
import { BoardShape } from '../../model/geometry.js'

export const engine = new GameEngine(MatrxRuntime)

export function createGame(
    board: BoardShape = BoardShape.Matrx,
    playerIds: string[] = ['white', 'black']
) {
    return MatrxRuntime.initializer.initializeGame(
        {
            id: 'matrx-test',
            typeId: 'matrx',
            ownerId: 'owner',
            seed: 5,
            config: { ...defaultGameConfig(MatrxInfo.configurator?.options ?? []), board },
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

export type MatrxGame = ReturnType<typeof createGame>

let counter = 0
export function actionBase(game: MatrxGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

export function execute(game: MatrxGame, state: MatrxGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

// Every way to remove each row: all singles go, any choice of pairs stays.
function removals(game: MatrxGame, state: MatrxGameState, playerId: string): GameAction[] {
    const { board } = new HydratedMatrxGameState(state)
    return board.rowsOf(playerId).flatMap((row) => {
        const pairs = row.reach.filter((coords) => board.topAt(coords)?.paired === true)
        return Array.from({ length: 2 ** pairs.length }, (_, mask) => ({
            ...actionBase(game, playerId),
            type: ActionType.RemoveRow,
            from: row.from,
            to: row.to,
            keep: pairs.filter((_, index) => (mask >> index) & 1)
        })).filter((action) => {
            try {
                execute(game, state, action)
                return true
            } catch {
                return false
            }
        })
    })
}

export function legalActions(game: MatrxGame, state: MatrxGameState): GameAction[] {
    const hydrated = new HydratedMatrxGameState(state)
    const playerId = state.activePlayerIds[0]
    const entries = hydrated.board.legalEntries()
    switch (state.machineState) {
        case MachineState.ResolvingRows:
            return removals(game, state, playerId)
        case MachineState.ExtraMove:
            return [
                { ...actionBase(game, playerId), type: ActionType.SkipExtraMove },
                ...entries.map((entry) => ({
                    ...actionBase(game, playerId),
                    type: ActionType.ExtraMove,
                    dot: entry.dot,
                    to: entry.line[0]
                }))
            ]
        default:
            return [
                ...entries.flatMap((entry) =>
                    hydrated.pushableKinds(playerId).map((kind) => ({
                        ...actionBase(game, playerId),
                        type: ActionType.PushPiece,
                        dot: entry.dot,
                        to: entry.line[0],
                        kind
                    }))
                ),
                ...hydrated.potentialMoves(playerId).map((potentialMove) => ({
                    ...actionBase(game, playerId),
                    type: ActionType.MovePotential,
                    ...potentialMove
                }))
            ]
    }
}

// Plays legal actions chosen by a seeded generator until the game ends.
export function playToEnd(game: MatrxGame, state: MatrxGameState, seed: number): MatrxGameState {
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
        if (steps >= 5000) throw Error('The playout did not end')
    }
    return state
}
