import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assertExists,
    type Game,
    type GameAction
} from '@tabletop/common'
import { Faction } from '../components/factions.js'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { StellarHorizonsRuntime } from '../definition/runtime.js'
import type {
    HydratedStellarHorizonsGameState,
    StellarHorizonsProjectedState
} from '../model/gameState.js'

export const engine = new GameEngine(StellarHorizonsRuntime)
export const MASTER_SEED = '0123456789abcdef0123456789abcdef'

export function createGame(playerCount: number): Game {
    return StellarHorizonsRuntime.initializer.initializeGame(
        {
            id: 'stellar-horizons-test',
            typeId: Definition.info.id,
            ownerId: 'owner',
            players: Array.from({ length: playerCount }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

export function hydrate(state: StellarHorizonsProjectedState): HydratedStellarHorizonsGameState {
    return StellarHorizonsRuntime.hydrator.hydrateState(structuredClone(state))
}

let actionCounter = 0

export function userAction<T extends Record<string, unknown>>(
    game: Game,
    playerId: string,
    type: ActionType,
    fields: T
): GameAction {
    actionCounter += 1
    return {
        id: `action-${actionCounter}`,
        gameId: game.id,
        source: ActionSource.User,
        playerId,
        type,
        ...fields
    }
}

export function execute(
    game: Game,
    state: StellarHorizonsProjectedState,
    action: GameAction
): StellarHorizonsProjectedState {
    return engine.executeCanonicalAction({ game, state, action }).updatedState
}

export function edit(
    state: StellarHorizonsProjectedState,
    change: (state: HydratedStellarHorizonsGameState) => void
): StellarHorizonsProjectedState {
    const hydrated = hydrate(state)
    change(hydrated)
    return hydrated.dehydrate()
}

export function takeTile(
    state: HydratedStellarHorizonsGameState,
    predicate: (id: string) => boolean
): string {
    const tileId = state.worldPool.find(predicate)
    assertExists(tileId, 'No matching tile in the pool')
    state.worldPool.splice(state.worldPool.indexOf(tileId), 1)
    return tileId
}

export const FACTION_PICKS: readonly Faction[] = [
    Faction.Starfarers,
    Faction.Givers,
    Faction.Praetorians,
    Faction.TruePath
]

export function startedGame(playerCount: number): {
    game: Game
    state: StellarHorizonsProjectedState
} {
    const game = createGame(playerCount)
    let state = engine.startGame(game, { masterSeed: MASTER_SEED }).initialState
    for (const faction of FACTION_PICKS.slice(0, playerCount)) {
        const [playerId] = state.activePlayerIds
        state = execute(
            game,
            state,
            userAction(game, playerId, ActionType.ChooseFaction, { faction })
        )
    }
    return { game, state }
}
