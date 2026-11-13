import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction,
    type GameConfig
} from '@tabletop/common'
import { Definition } from '../definition.js'
import { GipfPotentialsRuntime } from '../runtime.js'
import { GipfPotentialsInfo } from '../info.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import {
    HydratedGipfPotentialsGameState,
    type GipfPotentialsGameState
} from '../../model/gameState.js'
import { PieceKind } from '../../model/pieces.js'

export const engine = new GameEngine(GipfPotentialsRuntime)

// Each player's user has the player's id; the creator, if one plays, is `creator`.
export function createGame(
    config: GameConfig = {},
    playerIds: string[] = ['white', 'black'],
    creator = 'owner'
) {
    return GipfPotentialsRuntime.initializer.initializeGame(
        {
            id: 'gipf-potentials-test',
            typeId: 'gipf-potentials',
            ownerId: creator,
            seed: 5,
            config: {
                ...defaultGameConfig(GipfPotentialsInfo.configurator?.options ?? []),
                ...config
            },
            players: playerIds.map((id) => ({
                id,
                name: id,
                userId: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

export type GipfPotentialsGame = ReturnType<typeof createGame>

let counter = 0
export function actionBase(game: GipfPotentialsGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

export function execute(
    game: GipfPotentialsGame,
    state: GipfPotentialsGameState,
    action: GameAction
) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

// Every way to take each row: what must go goes, any choice of the rest stays.
function removals(
    game: GipfPotentialsGame,
    state: GipfPotentialsGameState,
    playerId: string
): GameAction[] {
    const { board } = new HydratedGipfPotentialsGameState(state)
    const actions: GameAction[] = board.rowsOf(playerId).flatMap((row) => {
        const keepable = row.reach.filter((coords) => board.mayStay(coords))
        return Array.from({ length: 2 ** keepable.length }, (_, mask) => ({
            ...actionBase(game, playerId),
            type: ActionType.RemoveRow,
            from: row.from,
            to: row.to,
            keep: keepable.filter((_, index) => (mask >> index) & 1)
        }))
    })
    actions.push({ ...actionBase(game, playerId), type: ActionType.FinishRemoving })
    return actions.filter((action) => {
        try {
            execute(game, state, action)
            return true
        } catch {
            return false
        }
    })
}

function potentialActions(
    game: GipfPotentialsGame,
    state: GipfPotentialsGameState,
    playerId: string
): GameAction[] {
    const current = new HydratedGipfPotentialsGameState(state)
    return current.potentialMoves(playerId).flatMap((potentialMove) => {
        const action = {
            ...actionBase(game, playerId),
            type: ActionType.MovePotential,
            ...potentialMove
        }
        if (current.board.topAt(potentialMove.to)?.kind !== PieceKind.Gipf) {
            return [action]
        }
        const reserve = current.getPlayerState(playerId).reserve
        return [1, 2].filter((cover) => cover <= reserve).map((cover) => ({ ...action, cover }))
    })
}

export function legalActions(
    game: GipfPotentialsGame,
    state: GipfPotentialsGameState
): GameAction[] {
    const current = new HydratedGipfPotentialsGameState(state)
    const playerId = state.activePlayerIds[0]
    const entries = current.board.legalEntries()
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
        default: {
            const kinds = current.pushableKinds(playerId)
            // Plain pieces only now and then while potentials remain, so games use them.
            const pushKinds =
                kinds.length > 1 && current.getPlayerState(playerId).potentialsInHand() > 0
                    ? kinds.filter((kind) => kind !== PieceKind.Basic)
                    : kinds
            return [
                ...entries.flatMap((entry) =>
                    pushKinds.map((kind) => ({
                        ...actionBase(game, playerId),
                        type: ActionType.PushPiece,
                        dot: entry.dot,
                        to: entry.line[0],
                        kind
                    }))
                ),
                ...potentialActions(game, state, playerId),
                ...potentialActions(game, state, playerId),
                ...potentialActions(game, state, playerId)
            ]
        }
    }
}

export function playToEnd(
    game: GipfPotentialsGame,
    state: GipfPotentialsGameState,
    seed: number
): GipfPotentialsGameState {
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
