import {
    GameEngine,
    HydratedPhaseManager,
    HydratedRoundManager,
    PlayerStatus,
    assert,
    assertExists,
    type Game
} from '@tabletop/common'
import type { CityId } from '../data/usaMap.js'
import { Definition } from '../definition/definition.js'
import { PhaseName } from '../definition/phases.js'
import { RideTheRailsRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import {
    HydratedRideTheRailsGameState,
    inCityIdOrder,
    type BuildingTurn,
    type Track,
    type TranscontinentalClaim,
    type YellowState
} from '../model/gameState.js'
import type { Shares } from '../model/playerState.js'

export const engine = new GameEngine(RideTheRailsRuntime)
export const masterSeed = '0123456789abcdef0123456789abcdef'

export const FIXTURE_PLAYER_IDS = ['p1', 'p2', 'p3', 'p4', 'p5'] as const

const ROUND_COUNT = 6

// R-2.1
const PHASE_ORDER: readonly PhaseName[] = [PhaseName.TakeShare, PhaseName.Build, PhaseName.Ride]

const PHASE_MACHINE_STATES: Readonly<Record<PhaseName, MachineState>> = {
    [PhaseName.TakeShare]: MachineState.TakingShares,
    [PhaseName.Build]: MachineState.Building,
    [PhaseName.Ride]: MachineState.Riding
}

export type StateRecipe = {
    playerCount?: number
    round?: number
    phase?: PhaseName
    currentPlayerId?: string
    money?: Record<string, number>
    shares?: Record<string, Shares>
    track?: Track
    passengers?: CityId[]
    yellow?: YellowState
    transcontinental?: TranscontinentalClaim
    building?: BuildingTurn
}

export function fixturePlayerIds(playerCount: number): string[] {
    return FIXTURE_PLAYER_IDS.slice(0, playerCount)
}

export function createGame(playerCount: number, seed = 11): Game {
    return RideTheRailsRuntime.initializer.initializeGame(
        {
            id: 'ride-the-rails-test',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed,
            config: {},
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

export function freshState(playerCount = 3): HydratedRideTheRailsGameState {
    const game = createGame(playerCount)
    const { initialState } = engine.startGame(game, {
        masterSeed,
        startingPositions: { playerIds: fixturePlayerIds(playerCount) }
    })
    return new HydratedRideTheRailsGameState(initialState)
}

// The turn order is p1, p2, ... The phase's first player acts unless
// currentPlayerId says otherwise: the last in turn order for Take a Share (R-2.2), else the first.
export function buildState(recipe: StateRecipe = {}): HydratedRideTheRailsGameState {
    const { playerCount = 3, round = 1, phase = PhaseName.TakeShare } = recipe
    assert(round >= 1 && round <= ROUND_COUNT, `No round ${round}`)
    const state = freshState(playerCount)

    state.roundManager = roundsUpTo(round)
    state.phaseManager = phasesUpTo(phase)
    state.machineState = PHASE_MACHINE_STATES[phase]

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
    state.yellow = structuredClone(recipe.yellow ?? { startedInChicago: false })
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
