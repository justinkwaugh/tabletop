import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../definition.js'
import { ZertzRuntime } from '../runtime.js'
import { ZertzInfo } from '../info.js'
import { ZertzSetup } from '../config.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import { HydratedZertzGameState, type ZertzGameState } from '../../model/gameState.js'

export const engine = new GameEngine(ZertzRuntime)

export function createGame(
    setup: ZertzSetup = ZertzSetup.Standard,
    playerIds: string[] = ['p0', 'p1']
) {
    return ZertzRuntime.initializer.initializeGame(
        {
            id: 'zertz-test',
            typeId: 'zertz',
            ownerId: 'owner',
            seed: 7,
            config: { ...defaultGameConfig(ZertzInfo.configurator?.options ?? []), setup },
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

export type ZertzGame = ReturnType<typeof createGame>

let counter = 0
export function actionBase(game: ZertzGame, playerId: string) {
    counter += 1
    return { id: `action-${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

export function execute(game: ZertzGame, state: ZertzGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

// Every action the player to act may take: each jump while one is open, or else every placement
// of each colour they may place, with each ring it would leave free to remove.
export function legalActions(game: ZertzGame, state: ZertzGameState): GameAction[] {
    if (state.machineState === MachineState.EndOfGame) return []
    const hydrated = new HydratedZertzGameState(state)
    const playerId = state.activePlayerIds[0]
    const { board } = hydrated
    const jumps = hydrated.openJumps()
    if (jumps.length > 0) {
        return jumps.map((jump) => ({
            ...actionBase(game, playerId),
            type: ActionType.Capture,
            from: jump.from,
            to: jump.to
        }))
    }
    return hydrated.placeableColors(playerId).flatMap((color) =>
        board.vacantRings().flatMap(({ coords }) => {
            const removable = hydrated.removableAfterPlacing(playerId, color, coords)
            const removals = removable.length === 0 ? [undefined] : removable
            return removals.map((remove) => ({
                ...actionBase(game, playerId),
                type: ActionType.PlaceMarble,
                color,
                coords,
                ...(remove === undefined ? {} : { remove })
            }))
        })
    )
}

// Plays legal actions chosen by a seeded generator until the game ends.
export function playToEnd(game: ZertzGame, state: ZertzGameState, seed: number): ZertzGameState {
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
        if (steps >= 300) throw Error('The playout did not end')
    }
    return state
}
