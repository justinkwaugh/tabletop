import {
    ActionSource,
    assert,
    assertExists,
    getPrng,
    type Game,
    type GameAction,
    type RandomFunction
} from '@tabletop/common'
import type { RailroadId } from '../data/railroads.js'
import { isCityHex } from '../data/usaMap.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedRideTheRailsGameState, RideTheRailsGameState } from '../model/gameState.js'
import { legalPlacements, type LegalPlacement } from '../rules/placement.js'
import { bestJourneys, type RankedJourney } from '../rules/routeSearch.js'
import { shareableRailroads } from '../rules/shares.js'
import { supplyOf } from '../rules/supply.js'
import { engine, hydrated } from './fixtures.js'
import { startWalk, type UserInput, type WalkStep } from './walk.js'

// How the scripted players pick a railroad, for a share and for a placement.
// - 'least-taken': one not yet taken this game first, so a game reaches every railroad.
// - 'scarcest': the one with the smallest supply, so the players empty supplies early
//   (R-1.1) and a building turn can open with nothing legal (R-3.2.4).
export type RailroadPreference = 'least-taken' | 'scarcest'

export type ScriptedOptions = {
    railroads: RailroadPreference
}

// One user action as submitted, and its whole cascade.
export type ScriptedStep = WalkStep & { submitted: GameAction }

export type CompleteGame = {
    game: Game
    initial: RideTheRailsGameState
    steps: ScriptedStep[]
    history: GameAction[]
    final: RideTheRailsGameState
}

const MAX_STEPS = 3_000
const JOURNEY_SEARCH_CAP = 2_000
// The chance a building turn ends with placements still legal, once EndBuilding has been seen.
const EARLY_END_CHANCE = 0.15

// A seeded player for whole games: it reads what the engine offers the deciding player, prefers
// an action type and a railroad not yet taken this game, and submits only user actions. The
// PRNG is seeded, so the same seed plays the same game.
export class ScriptedPlayer {
    private readonly random: RandomFunction
    private readonly actionsTaken = new Set<string>()
    private readonly sharesTaken = new Set<RailroadId>()
    private readonly railroadsBuilt = new Set<RailroadId>()

    constructor(
        seed: number,
        private readonly options: ScriptedOptions
    ) {
        this.random = getPrng(seed)
    }

    choose(game: Game, state: RideTheRailsGameState): UserInput {
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `Stalled: no player decides in ${state.machineState}`)
        const offered = engine.getValidActionTypesForPlayer(game, state, playerId)
        assert(
            offered.length > 0,
            `Stalled: ${playerId} decides in ${state.machineState} but is offered nothing`
        )
        const gameState = hydrated(state)
        const type =
            offered.find((offer) => !this.actionsTaken.has(offer)) ?? this.usual(offered, gameState)
        this.actionsTaken.add(type)
        return this.inputFor(type, gameState, playerId)
    }

    // Once every offered type has been taken: keep building, now and then stopping early.
    private usual(offered: string[], state: HydratedRideTheRailsGameState): string {
        const mayStop =
            offered.includes(ActionType.EndBuilding) &&
            this.options.railroads === 'least-taken' &&
            (state.building?.placed ?? 0) > 0 &&
            this.random() < EARLY_END_CHANCE
        if (mayStop) {
            return ActionType.EndBuilding
        }
        const [first] = offered
        assertExists(first, 'Something is offered')
        return first
    }

    private inputFor(
        type: string,
        state: HydratedRideTheRailsGameState,
        playerId: string
    ): UserInput {
        switch (type) {
            case ActionType.TakeShare: {
                const railroadId = this.shareChoice(state)
                this.sharesTaken.add(railroadId)
                return { type, playerId, railroadId }
            }
            case ActionType.PlaceLocomotive: {
                const { railroadId, hexId } = this.placementChoice(state, playerId)
                this.railroadsBuilt.add(railroadId)
                return { type, playerId, railroadId, hexId }
            }
            case ActionType.EndBuilding:
            case ActionType.PassJourney:
                return { type, playerId }
            case ActionType.RideJourney:
                return { type, playerId, links: this.journeyChoice(state, playerId).links }
            default:
                throw Error(`Stalled: ${playerId} is offered ${type}, which is no user action`)
        }
    }

    // R-3.1
    private shareChoice(state: HydratedRideTheRailsGameState): RailroadId {
        const shareable = shareableRailroads(state)
        if (this.options.railroads === 'scarcest') {
            return this.scarcest(state, shareable)
        }
        const fresh = shareable.filter((railroadId) => !this.sharesTaken.has(railroadId))
        return this.pick(fresh.length > 0 ? fresh : shareable)
    }

    // R-3.2: a placement into a city completes a link, so it is preferred more often than not.
    private placementChoice(
        state: HydratedRideTheRailsGameState,
        playerId: string
    ): LegalPlacement {
        const placements = legalPlacements(state, playerId)
        const railroadIds = [...new Set(placements.map((placement) => placement.railroadId))]
        const fresh = railroadIds.filter((railroadId) => !this.railroadsBuilt.has(railroadId))
        const railroadId =
            this.options.railroads === 'scarcest'
                ? this.scarcest(state, railroadIds)
                : this.pick(fresh.length > 0 ? fresh : railroadIds)
        const ofRailroad = placements.filter((placement) => placement.railroadId === railroadId)
        const intoCities = ofRailroad.filter(({ hexId }) => isCityHex(hexId))
        return this.pick(intoCities.length > 0 && this.random() < 0.6 ? intoCities : ofRailroad)
    }

    // R-3.3.1, R-3.3.2: the journey with the greatest gain from any city with a passenger.
    private journeyChoice(state: HydratedRideTheRailsGameState, playerId: string): RankedJourney {
        const best = state.passengers
            .flatMap((cityId) =>
                bestJourneys(state, cityId, playerId, JOURNEY_SEARCH_CAP).journeys.slice(0, 1)
            )
            .reduce<RankedJourney | undefined>(
                (chosen, journey) =>
                    chosen === undefined || journey.gain > chosen.gain ? journey : chosen,
                undefined
            )
        assertExists(best, `Stalled: ${playerId} is offered a journey the search cannot find`)
        return best
    }

    private scarcest(state: HydratedRideTheRailsGameState, railroadIds: RailroadId[]): RailroadId {
        const chosen = railroadIds.reduce<RailroadId | undefined>(
            (least, railroadId) =>
                least === undefined || supplyOf(state, railroadId) < supplyOf(state, least)
                    ? railroadId
                    : least,
            undefined
        )
        assertExists(chosen, 'The scripted player has no railroad to choose')
        return chosen
    }

    private pick<T>(options: readonly T[]): T {
        const option = options[Math.floor(this.random() * options.length)]
        assertExists(option, 'The scripted player has nothing to choose from')
        return option
    }
}

export function submitAction(
    game: Game,
    state: RideTheRailsGameState,
    submitted: GameAction,
    gameEngine = engine
): { updatedState: RideTheRailsGameState; processedActions: GameAction[] } {
    return gameEngine.executeCanonicalAction({ game, state, action: submitted })
}

// Plays a whole game from setup through the engine, one user action and its cascade at a time.
export function playCompleteGame(
    playerCount: number,
    seed: number,
    options: ScriptedOptions = { railroads: 'least-taken' }
): CompleteGame {
    const { game, initial } = startWalk(playerCount, seed)
    const player = new ScriptedPlayer(seed, options)
    const steps: ScriptedStep[] = []
    let state = initial
    while (state.result === undefined) {
        assert(steps.length < MAX_STEPS, `Stalled: no end within ${MAX_STEPS} user actions`)
        const input = player.choose(game, state)
        const submitted: GameAction = {
            id: `scripted-${state.actionCount}`,
            gameId: state.gameId,
            source: ActionSource.User,
            ...input
        }
        const { updatedState, processedActions } = submitAction(game, state, submitted)
        steps.push({
            input,
            submitted,
            before: state,
            after: updatedState,
            processed: processedActions
        })
        state = updatedState
    }
    return {
        game,
        initial,
        steps,
        history: steps.flatMap((step) => step.processed),
        final: state
    }
}
