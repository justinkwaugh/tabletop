import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../definition.js'
import { PunctRuntime } from '../runtime.js'
import { PunctInfo } from '../info.js'
import type { Variant, WhitePlayer } from '../config.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import { HydratedPunctGameState, type PunctGameState } from '../../model/gameState.js'

export const engine = new GameEngine(PunctRuntime)

// A fixed master seed, so the draw for White is the same on every run.
export const MASTER_SEED = '0123456789abcdef0123456789abcdef'

export type PunctConfig = { variant?: Variant; whitePlayer?: WhitePlayer }

export type Owner = { ownerId: string; userIds: Record<string, string> }

// `userIds` gives seats a user; the game's creator is the user `ownerId`.
export function createGame(
    config: PunctConfig = {},
    playerIds: string[] = ['white', 'black'],
    owner: Owner = { ownerId: 'owner', userIds: {} }
) {
    return PunctRuntime.initializer.initializeGame(
        {
            id: 'punct-test',
            typeId: 'punct',
            ownerId: owner.ownerId,
            seed: 5,
            config: { ...defaultGameConfig(PunctInfo.configurator?.options ?? []), ...config },
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

export type PunctGame = ReturnType<typeof createGame>

let counter = 0
export function actionBase(game: PunctGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

export function execute(game: PunctGame, state: PunctGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

// Every placement and every move the player to act may make.
export function legalActions(
    game: PunctGame,
    state: PunctGameState
): { placements: GameAction[]; moves: GameAction[] } {
    const hydrated = new HydratedPunctGameState(state)
    const [playerId] = state.activePlayerIds
    const placements = hydrated.kindsInReserve(playerId).flatMap((kind) =>
        hydrated.entriesOf(playerId, kind).map((entry) => ({
            ...actionBase(game, playerId),
            type: ActionType.PlacePiece,
            kind,
            punct: entry.punct,
            rotation: entry.rotation
        }))
    )
    const moves = hydrated.board.movablePieces(playerId).flatMap((piece) =>
        hydrated.board.movesOf(piece).map((move) => ({
            ...actionBase(game, playerId),
            type: ActionType.MovePiece,
            from: piece.punct,
            to: move.punct,
            rotation: move.rotation
        }))
    )
    return { placements, moves }
}

// Plays legal actions chosen by a seeded generator until the game ends. Moves far outnumber
// placements, so each turn first picks one or the other, leaning to moves.
export function playToEnd(game: PunctGame, state: PunctGameState, seed: number): PunctGameState {
    let value = seed + 1
    const next = () => {
        value = (value * 1103515245 + 12345) % 2147483648
        return value / 2147483648
    }
    let steps = 0
    while (state.machineState !== MachineState.EndOfGame) {
        const { placements, moves } = legalActions(game, state)
        const wantMove = next() < 0.6
        const pool = (wantMove && moves.length > 0) || placements.length === 0 ? moves : placements
        if (pool.length === 0) throw Error(`No legal action after ${steps} steps`)
        state = execute(game, state, pool[Math.floor(next() * pool.length)])
        steps += 1
        if (steps >= 400) throw Error('The playout did not end')
    }
    return state
}
