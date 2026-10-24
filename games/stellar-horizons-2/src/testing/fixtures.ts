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
import { MachineState } from '../definition/states.js'
import { Definition } from '../definition/definition.js'
import { StellarHorizonsRuntime } from '../definition/runtime.js'
import type {
    HydratedStellarHorizonsGameState,
    StellarHorizonsProjectedState
} from '../model/gameState.js'
import { DirectiveStatus, baseKey, type Base, type ShipState } from '../model/pieces.js'
import { TurnPhase } from '../model/turn.js'
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
    if (phase === TurnPhase.Directives) {
        return chooseFirstDirective(game, state)
    }
    return executeAll(game, state, userAction(game, playerId, ActionType.EndPhase, { phase }))
}

export function firstDrawnDirectiveId(
    state: StellarHorizonsProjectedState,
    playerId: string
): string {
    const drawn = hydrate(state)
        .getPlayerState(playerId)
        .heldDirectives.find((held) => held.status === DirectiveStatus.Drawn)
    assertExists(drawn?.directiveId, `${playerId} has no directive to choose`)
    return drawn.directiveId
}

// The acting Player keeps the first of the directives they drew (rulebook 5.1).
export function chooseFirstDirective(game: Game, state: StellarHorizonsProjectedState) {
    const [playerId] = state.activePlayerIds
    return executeAll(
        game,
        state,
        userAction(game, playerId, ActionType.ChooseDirective, {
            directiveId: firstDrawnDirectiveId(state, playerId)
        })
    )
}

// Gives the Player this directive in place of the one they hold, taking it from the pool or
// from whoever holds it, who takes one from the pool instead (for tests and harness scenarios).
export function giveDirective(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    directiveId: string
) {
    const pile = state.directivePile
    const holder = state.players.find((player) =>
        player.heldDirectives.some((held) => held.directiveId === directiveId)
    )
    if (holder && holder.playerId !== playerId) {
        const [replacement] = pile.directives.splice(0, 1)
        holder.heldDirectives = holder.heldDirectives.map((held) =>
            held.directiveId === directiveId ? { ...held, directiveId: replacement } : held
        )
    }
    const player = state.getPlayerState(playerId)
    for (const held of player.heldDirectives) {
        if (held.directiveId && held.directiveId !== directiveId) {
            pile.directives.push(held.directiveId)
        }
    }
    const index = pile.directives.indexOf(directiveId)
    if (index >= 0) {
        pile.directives.splice(index, 1)
    }
    pile.remaining = pile.directives.length
    player.heldDirectives = [{ playerId, status: DirectiveStatus.Current, directiveId }]
}

// Every Player keeps the first directive drawn, while directives are being chosen.
export function chooseDirectives(
    game: Game,
    state: StellarHorizonsProjectedState
): StellarHorizonsProjectedState {
    let current = state
    while (current.machineState === MachineState.ChoosingDirective) {
        current = chooseFirstDirective(game, current).state
    }
    return current
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
        if (
            active === phase &&
            (playerId === undefined || current.activePlayerIds[0] === playerId)
        ) {
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
    {
        resting = false,
        choosingDirectives = false
    }: { resting?: boolean; choosingDirectives?: boolean } = {}
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
    return {
        game,
        state: resting || choosingDirectives ? state : chooseDirectives(game, state)
    }
}
