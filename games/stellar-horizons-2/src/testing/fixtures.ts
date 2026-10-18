import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assertExists,
    executeInLocalGame,
    type Game,
    type GameAction,
    type GameConfig
} from '@tabletop/common'
import { Faction } from '../components/factions.js'
import { ScenarioId } from '../components/scenarios.js'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { StellarHorizonsRuntime } from '../definition/runtime.js'
import type {
    HydratedStellarHorizonsGameState,
    StellarHorizonsProjectedState
} from '../model/gameState.js'
import { baseKey, type Base, type ShipState } from '../model/pieces.js'
import type { TurnPhase } from '../model/turn.js'
import { playPhase } from '../model/turnPlan.js'

export const engine = new GameEngine(StellarHorizonsRuntime)
export const MASTER_SEED = '0123456789abcdef0123456789abcdef'

export const VOYAGES_CONFIG: GameConfig = { scenario: ScenarioId.Voyages }

export function createGame(playerCount: number, config: GameConfig = {}): Game {
    return StellarHorizonsRuntime.initializer.initializeGame(
        {
            id: 'stellar-horizons-test',
            typeId: Definition.info.id,
            ownerId: 'owner',
            config,
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

export function executeAll(
    game: Game,
    state: StellarHorizonsProjectedState,
    action: GameAction
): { state: StellarHorizonsProjectedState; processedActions: GameAction[] } {
    const result = executeInLocalGame({ engine, game, state, action })
    return { state: result.updatedState, processedActions: result.processedActions }
}

export function execute(
    game: Game,
    state: StellarHorizonsProjectedState,
    action: GameAction
): StellarHorizonsProjectedState {
    return executeAll(game, state, action).state
}

export function executeWithoutAdvancing(
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

export function placeShip(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    shipId: string,
    systemId: string,
    overrides: Partial<ShipState> = {}
): ShipState {
    const ship: ShipState = {
        shipId,
        playerId,
        systemId,
        transit: 0,
        damage: 0,
        settlements: 0,
        goods: [],
        loadedFromBase: false,
        explored: false,
        ...overrides
    }
    state.ships[shipId] = ship
    return ship
}

export function placeBase(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string,
    settlements: number
): Base {
    const base: Base = {
        playerId,
        systemId,
        settlements,
        spent: 0,
        cloned: false,
        goods: [],
        goodsReceived: 0
    }
    state.bases[baseKey(playerId, systemId)] = base
    return base
}

export function endPhase(
    game: Game,
    state: StellarHorizonsProjectedState
): StellarHorizonsProjectedState {
    return endPhaseWithActions(game, state).state
}

export function endPhaseWithActions(game: Game, state: StellarHorizonsProjectedState) {
    const [playerId] = state.activePlayerIds
    const phase = playPhase(state)
    assertExists(phase, `Nobody is playing a phase in ${state.machineState}`)
    return executeAll(game, state, userAction(game, playerId, ActionType.EndPhase, { phase }))
}

export function finishDecade(
    game: Game,
    state: StellarHorizonsProjectedState
): StellarHorizonsProjectedState {
    let current = state
    while (playPhase(current) !== undefined && current.year === state.year) {
        current = endPhase(game, current)
    }
    return current
}

export function advanceTo(
    game: Game,
    state: StellarHorizonsProjectedState,
    phase: TurnPhase,
    playerId?: string
): StellarHorizonsProjectedState {
    let current = state
    for (let guard = 0; guard < 100; guard++) {
        const active = playPhase(current)
        if (active === phase && (playerId === undefined || current.activePlayerIds[0] === playerId)) {
            return current
        }
        assertExists(active, `${phase} was not reached before ${current.machineState}`)
        current = endPhase(game, current)
    }
    throw new Error(`${phase} was not reached`)
}

export const FACTION_PICKS: readonly Faction[] = [
    Faction.Starfarers,
    Faction.Givers,
    Faction.Praetorians,
    Faction.TruePath
]

export function startedGame(
    playerCount: number,
    config: GameConfig = {},
    { resting = false }: { resting?: boolean } = {}
): {
    game: Game
    state: StellarHorizonsProjectedState
} {
    const game = createGame(playerCount, config)
    let state = engine.startGame(game, { masterSeed: MASTER_SEED }).initialState
    const picks = FACTION_PICKS.slice(0, playerCount)
    picks.forEach((faction, index) => {
        const [playerId] = state.activePlayerIds
        const action = userAction(game, playerId, ActionType.ChooseFaction, { faction })
        const last = index === picks.length - 1
        state =
            resting && last
                ? executeWithoutAdvancing(game, state, action)
                : execute(game, state, action)
    })
    return { game, state }
}
