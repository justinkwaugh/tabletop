import { ActionSource, assert, assertExists, type Game, type GameAction } from '@tabletop/common'
import { isCityHex } from '../data/usaMap.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedRideTheRailsGameState, RideTheRailsGameState } from '../model/gameState.js'
import { legalPlacements, type LegalPlacement } from '../rules/placement.js'
import { bestJourneys, type RankedJourney } from '../rules/routeSearch.js'
import { shareableRailroads } from '../rules/shares.js'
import { createGame, engine, fixturePlayerIds, hydrated, masterSeed } from './fixtures.js'

export type UserInput = Omit<GameAction, 'id' | 'gameId' | 'source'> & Record<string, unknown>

export type WalkStep = {
    input: UserInput
    before: RideTheRailsGameState
    after: RideTheRailsGameState
    processed: GameAction[]
}

export type Walk = {
    game: Game
    initial: RideTheRailsGameState
    steps: WalkStep[]
    history: GameAction[]
    final: RideTheRailsGameState
}

const MAX_STEPS = 2_000
const JOURNEY_SEARCH_CAP = 2_000

export function walkSeed(seed: number): string {
    return `${masterSeed.slice(0, -2)}${String(seed).padStart(2, '0')}`
}

// Every choice is read from what the engine offers the deciding player, and the turn counter
// picks among the options, so a walk is the same each time it is played: no Math.random.
export function walkInput(state: RideTheRailsGameState, game: Game, step: number): UserInput {
    const [playerId] = state.activePlayerIds
    assertExists(playerId, `No player decides in ${state.machineState}`)
    const offered = engine.getValidActionTypesForPlayer(game, state, playerId)
    const gameState = hydrated(state)

    if (offered.includes(ActionType.TakeShare)) {
        const railroadIds = shareableRailroads(gameState)
        return { type: ActionType.TakeShare, playerId, railroadId: pick(railroadIds, step) }
    }
    if (offered.includes(ActionType.PlaceLocomotive)) {
        const placed = gameState.building?.placed ?? 0
        const stopsEarly = offered.includes(ActionType.EndBuilding) && placed > 0 && step % 7 === 0
        if (!stopsEarly) {
            const { railroadId, hexId } = choosePlacement(
                legalPlacements(gameState, playerId),
                step
            )
            return { type: ActionType.PlaceLocomotive, playerId, railroadId, hexId }
        }
    }
    if (offered.includes(ActionType.EndBuilding)) {
        return { type: ActionType.EndBuilding, playerId }
    }
    if (offered.includes(ActionType.RideJourney)) {
        return {
            type: ActionType.RideJourney,
            playerId,
            links: bestJourney(gameState, playerId).links
        }
    }
    if (offered.includes(ActionType.PassJourney)) {
        return { type: ActionType.PassJourney, playerId }
    }
    throw Error(`${playerId} is offered nothing the walk can choose in ${state.machineState}`)
}

// A placement into a city completes a link, so the walk prefers one.
function choosePlacement(placements: LegalPlacement[], step: number): LegalPlacement {
    const intoCities = placements.filter(({ hexId }) => isCityHex(hexId))
    return pick(intoCities.length > 0 ? intoCities : placements, step)
}

function bestJourney(state: HydratedRideTheRailsGameState, playerId: string): RankedJourney {
    const best = state.passengers
        .flatMap((cityId) =>
            bestJourneys(state, cityId, playerId, JOURNEY_SEARCH_CAP).journeys.slice(0, 1)
        )
        .reduce<RankedJourney | undefined>(
            (chosen, journey) =>
                chosen === undefined || journey.gain > chosen.gain ? journey : chosen,
            undefined
        )
    assertExists(best, 'A journey is offered, so one exists')
    return best
}

function pick<T>(options: readonly T[], step: number): T {
    const option = options[step % options.length]
    assertExists(option, 'The walk has nothing to choose from')
    return option
}

export function startWalk(playerCount: number, seed: number) {
    const game = createGame(playerCount, seed)
    const { initialState } = engine.startGame(game, {
        masterSeed: walkSeed(seed),
        startingPositions: { playerIds: fixturePlayerIds(playerCount) }
    })
    return { game, initial: initialState }
}

export function executeInput(game: Game, state: RideTheRailsGameState, input: UserInput): WalkStep {
    const action = {
        id: `walk-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        ...input
    }
    const result = engine.executeCanonicalAction({ game, state, action })
    return { input, before: state, after: result.updatedState, processed: result.processedActions }
}

// Plays a whole game, calling onStep after each user action and its cascade.
export function walkGame(
    playerCount: number,
    seed: number,
    onStep: (step: WalkStep) => void = () => {}
): Walk {
    const { game, initial } = startWalk(playerCount, seed)
    const steps: WalkStep[] = []
    let state = initial
    for (let step = 0; state.result === undefined; step++) {
        assert(step < MAX_STEPS, 'The walk did not finish')
        const walked = executeInput(game, state, walkInput(state, game, step + seed))
        steps.push(walked)
        onStep(walked)
        state = walked.after
    }
    return {
        game,
        initial,
        steps,
        history: steps.flatMap((step) => step.processed),
        final: state
    }
}
