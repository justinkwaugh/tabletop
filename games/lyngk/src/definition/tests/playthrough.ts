import {
    ActionSource,
    defaultGameConfig,
    GameEngine,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Definition } from '../definition.js'
import { LyngkRuntime } from '../runtime.js'
import { LyngkInfo } from '../info.js'
import { LyngkVariant } from '../config.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import { HydratedLyngkGameState, type LyngkGameState } from '../../model/gameState.js'

export const engine = new GameEngine(LyngkRuntime)

// A fixed master seed, so the deal is the same on every run.
export const MASTER_SEED = '0123456789abcdef0123456789abcdef'

export function createGame(
    variant: LyngkVariant = LyngkVariant.Standard,
    playerIds: string[] = ['alice', 'bob']
) {
    return LyngkRuntime.initializer.initializeGame(
        {
            id: 'lyngk-test',
            typeId: 'lyngk',
            ownerId: 'owner',
            seed: 5,
            config: { ...defaultGameConfig(LyngkInfo.configurator?.options ?? []), variant },
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

export type LyngkGame = ReturnType<typeof createGame>

let counter = 0
export function actionBase(game: LyngkGame, playerId: string) {
    counter += 1
    return { id: `a${counter}`, gameId: game.id, source: ActionSource.User, playerId }
}

export function execute(game: LyngkGame, state: LyngkGameState, action: GameAction) {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

// Every action the player to act may take: each claim open to them, then each move.
export function legalActions(game: LyngkGame, state: LyngkGameState): GameAction[] {
    const hydrated = new HydratedLyngkGameState(state)
    const [playerId] = state.activePlayerIds
    const claims = hydrated.claimableColors(playerId).map((color) => ({
        ...actionBase(game, playerId),
        type: ActionType.ClaimColor,
        color
    }))
    const moves = hydrated.pathsFor(playerId).map((path) => ({
        ...actionBase(game, playerId),
        type: ActionType.MoveStack,
        from: path.from,
        via: path.via,
        to: path.to
    }))
    return [...claims, ...moves]
}

// Plays legal actions chosen by a seeded generator until the game ends.
export function playToEnd(game: LyngkGame, state: LyngkGameState, seed: number): LyngkGameState {
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
        if (steps >= 500) throw Error('The playout did not end')
    }
    return state
}
