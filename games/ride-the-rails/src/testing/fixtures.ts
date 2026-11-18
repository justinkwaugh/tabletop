import {
    ActionSource,
    GameEngine,
    HydratedPhaseManager,
    HydratedRoundManager,
    PlayerStatus,
    assert,
    assertExists,
    type Game,
    type GameAction
} from '@tabletop/common'
import { isEndBuilding } from '../actions/endBuilding.js'
import { isFinishBuilding } from '../actions/finishBuilding.js'
import { isPlaceLocomotive } from '../actions/placeLocomotive.js'
import type { CityId } from '../data/boardMap.js'
import type { MapId } from '../data/maps.js'
import { Definition } from '../definition/definition.js'
import { PhaseName } from '../definition/phases.js'
import { RideTheRailsRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import {
    HydratedRideTheRailsGameState,
    inCityIdOrder,
    type BuildingTurn,
    type RideTheRailsGameState,
    type Track,
    type TranscontinentalClaim
} from '../model/gameState.js'
import type { Shares } from '../model/playerState.js'
import { ROUND_COUNT } from '../rules/endOfRound.js'
import { PHASE_ORDER } from '../rules/phaseOrder.js'

export const engine = new GameEngine(RideTheRailsRuntime)
export const masterSeed = '0123456789abcdef0123456789abcdef'

export const FIXTURE_PLAYER_IDS = ['p1', 'p2', 'p3', 'p4', 'p5'] as const

const PHASE_MACHINE_STATES: Readonly<Record<PhaseName, MachineState>> = {
    [PhaseName.TakeShare]: MachineState.TakingShares,
    [PhaseName.Build]: MachineState.Building,
    [PhaseName.Ride]: MachineState.Riding
}

export type StateRecipe = {
    playerCount?: number
    /** The map the game is created on; the USA when absent. */
    mapId?: MapId
    round?: number
    phase?: PhaseName
    currentPlayerId?: string
    /** The round's turn order; p1, p2, ... when absent. Rounds after the first set it by money (R-2.5.1). */
    turnOrder?: readonly string[]
    money?: Record<string, number>
    shares?: Record<string, Shares>
    track?: Track
    passengers?: CityId[]
    transcontinental?: TranscontinentalClaim
    building?: BuildingTurn
}

export function fixturePlayerIds(playerCount: number): string[] {
    return FIXTURE_PLAYER_IDS.slice(0, playerCount)
}

// A game created without a map plays the USA, as a game stored before the map option did.
export function createGame(playerCount: number, seed = 11, mapId?: MapId): Game {
    return RideTheRailsRuntime.initializer.initializeGame(
        {
            id: 'ride-the-rails-test',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed,
            config: mapId === undefined ? {} : { map: mapId },
            players: fixturePlayerIds(playerCount).map((playerId) => ({
                id: playerId,
                name: `Player ${playerId}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

export function freshState(playerCount = 3, mapId?: MapId): HydratedRideTheRailsGameState {
    const game = createGame(playerCount, 11, mapId)
    const { initialState } = engine.startGame(game, {
        masterSeed,
        startingPositions: { playerIds: fixturePlayerIds(playerCount) }
    })
    return new HydratedRideTheRailsGameState(initialState)
}

// The turn order is the recipe's, else p1, p2, ... The phase's first player acts unless
// currentPlayerId says otherwise: the last in turn order for Take a Share (R-2.2), else the first.
export function buildState(recipe: StateRecipe = {}): HydratedRideTheRailsGameState {
    const { playerCount = 3, round = 1, phase = PhaseName.TakeShare } = recipe
    assert(round >= 1 && round <= ROUND_COUNT, `No round ${round}`)
    const state = freshState(playerCount, recipe.mapId)

    state.roundManager = roundsUpTo(round)
    state.phaseManager = phasesUpTo(phase)
    state.machineState = PHASE_MACHINE_STATES[phase]

    if (recipe.turnOrder) {
        assert(
            [...recipe.turnOrder].sort().join() === [...state.turnManager.turnOrder].sort().join(),
            `The turn order ${recipe.turnOrder.join()} is not every seat once`
        )
        state.turnManager.turnOrder = [...recipe.turnOrder]
    }
    const turnOrder = state.turnManager.turnOrder
    const firstPlayerId = phase === PhaseName.TakeShare ? turnOrder.at(-1) : turnOrder[0]
    const currentPlayerId = recipe.currentPlayerId ?? firstPlayerId
    assertExists(currentPlayerId, 'A fixture needs players')
    assert(turnOrder.includes(currentPlayerId), `No player ${currentPlayerId}`)
    // Replace the turn setup opened, so the recipe's player holds the only open turn.
    state.turnManager.series = []
    state.turnManager.startTurn(currentPlayerId, state.actionCount)
    state.activePlayerIds = [currentPlayerId]

    for (const [playerId, money] of Object.entries(recipe.money ?? {})) {
        state.getPlayerState(playerId).money = money
    }
    for (const [playerId, shares] of Object.entries(recipe.shares ?? {})) {
        state.getPlayerState(playerId).shares = { ...shares }
    }

    state.track = structuredClone(recipe.track ?? {})
    if (recipe.passengers) {
        state.passengers = inCityIdOrder(recipe.passengers)
    }
    if (recipe.transcontinental) {
        state.transcontinental = { ...recipe.transcontinental }
    }
    const building =
        recipe.building ??
        (phase === PhaseName.Build ? { placed: 0, usedMountain: false } : undefined)
    if (building) {
        state.building = { ...building }
    }

    return new HydratedRideTheRailsGameState(state.dehydrate())
}

function roundsUpTo(round: number): HydratedRoundManager {
    const roundManager = HydratedRoundManager.generate()
    for (let number = 1; number < round; number++) {
        roundManager.startRound(0)
        roundManager.endRound(0)
    }
    roundManager.startRound(0)
    return roundManager
}

function phasesUpTo(phase: PhaseName): HydratedPhaseManager {
    const phaseManager = HydratedPhaseManager.generate()
    for (const name of PHASE_ORDER.slice(0, PHASE_ORDER.indexOf(phase))) {
        phaseManager.startPhase(name, 0)
        phaseManager.endPhase(0)
    }
    phaseManager.startPhase(phase, 0)
    return phaseManager
}

export type ActionRun = {
    before: RideTheRailsGameState
    after: RideTheRailsGameState
    processed: GameAction[]
}

// Runs one user action and its whole cascade through the engine.
export function runAction(
    state: HydratedRideTheRailsGameState,
    fields: Omit<GameAction, 'id' | 'gameId' | 'source'> & Record<string, unknown>
): ActionRun {
    const before = state.dehydrate()
    const action = {
        id: `a${before.actionCount}`,
        gameId: before.gameId,
        source: ActionSource.User,
        ...fields
    }
    const result = engine.executeCanonicalAction({
        game: createGame(state.players.length),
        state: before,
        action
    })
    return { before, after: result.updatedState, processed: result.processedActions }
}

export function undoRun(run: ActionRun): RideTheRailsGameState {
    return run.processed
        .toReversed()
        .reduce((state, action) => engine.undoProcessedAction({ state, action }), run.after)
}

export function hydrated(state: RideTheRailsGameState): HydratedRideTheRailsGameState {
    return new HydratedRideTheRailsGameState(structuredClone(state))
}

export function buildingMetadataOf(action: GameAction | undefined): unknown {
    if (isPlaceLocomotive(action) || isEndBuilding(action) || isFinishBuilding(action)) {
        return action.metadata
    }
    return undefined
}
