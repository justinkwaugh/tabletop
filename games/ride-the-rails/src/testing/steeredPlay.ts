import { assertExists, type GameAction } from '@tabletop/common'
import type { HexId } from '../data/hexes.js'
import type { RailroadId } from '../data/railroads.js'
import { adjacentHexIds, usaCity } from '../data/usaMap.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedRideTheRailsGameState, Track } from '../model/gameState.js'
import { legalPlacements, type LegalPlacement } from '../rules/placement.js'
import { firstLinkFrom } from '../rules/routeSearch.js'
import { shareableRailroads } from '../rules/shares.js'
import { railroadsIn } from '../rules/track.js'
import { createGame, engine, hydrated, runAction, type ActionRun } from './fixtures.js'

type UserActionFields = Omit<GameAction, 'id' | 'gameId' | 'source'> & Record<string, unknown>

// How the players of a steered game choose, within the moves the rules offer them.
export type Steering = {
    // R-3.1: the railroads to take a share of, most wanted first; any other shareable one else.
    sharePreference: (state: HydratedRideTheRailsGameState) => readonly RailroadId[]
    // R-3.2.1, R-4.1.2, R-4.2: the hexes each railroad builds towards. None ends the building turn.
    targetsOf: (state: HydratedRideTheRailsGameState, railroadId: RailroadId) => readonly HexId[]
    // A placement the players leave alone even when it is legal and makes progress.
    refuses?: (state: HydratedRideTheRailsGameState, placement: LegalPlacement) => boolean
}

// A game from setup, with the turn order the seed draws (R-1.3).
export function seededGame(playerCount: number, masterSeed: string): HydratedRideTheRailsGameState {
    const { initialState } = engine.startGame(createGame(playerCount), { masterSeed })
    return hydrated(initialState)
}

// Hex steps from every hex to the nearest target.
function stepsTo(targets: readonly HexId[]): ReadonlyMap<HexId, number> {
    const steps = new Map<HexId, number>(targets.map((hexId) => [hexId, 0]))
    const frontier = [...targets]
    for (let index = 0; index < frontier.length; index++) {
        const hexId = frontier[index]
        const next = (steps.get(hexId) ?? 0) + 1
        for (const adjacent of adjacentHexIds(hexId)) {
            if (!steps.has(adjacent)) {
                steps.set(adjacent, next)
                frontier.push(adjacent)
            }
        }
    }
    return steps
}

function nearestTrack(
    track: Track,
    railroadId: RailroadId,
    steps: ReadonlyMap<HexId, number>
): number {
    return Math.min(
        ...[...steps].flatMap(([hexId, count]) =>
            railroadsIn(track, hexId).includes(railroadId) ? [count] : []
        )
    )
}

// R-3.2: the legal placement that brings a railroad nearest its targets, if one brings it nearer.
export function steeredPlacement(
    state: HydratedRideTheRailsGameState,
    playerId: string,
    steering: Steering
): LegalPlacement | undefined {
    let best: { placement: LegalPlacement; steps: number } | undefined
    for (const placement of legalPlacements(state, playerId)) {
        const targets = steering.targetsOf(state, placement.railroadId)
        if (targets.length === 0 || steering.refuses?.(state, placement)) {
            continue
        }
        const steps = stepsTo(targets)
        const count = steps.get(placement.hexId) ?? Infinity
        const progress = count < nearestTrack(state.track, placement.railroadId, steps)
        if (progress && (best === undefined || count < best.steps)) {
            best = { placement, steps: count }
        }
    }
    return best?.placement
}

// R-3.3.1, R-3.3.2: a one-link journey from the first passenger that has one, else a pass.
function journeyOrPass(state: HydratedRideTheRailsGameState, playerId: string): UserActionFields {
    for (const cityId of state.passengers) {
        const { hexId } = usaCity(cityId)
        const link = firstLinkFrom(state, hexId, [hexId])
        if (link) {
            return { type: ActionType.RideJourney, playerId, links: [link] }
        }
    }
    return { type: ActionType.PassJourney, playerId }
}

// The one user action the steered player to act makes next.
export function steeredAction(
    state: HydratedRideTheRailsGameState,
    steering: Steering
): UserActionFields {
    const [playerId] = state.activePlayerIds
    assertExists(playerId, `No player acts in ${state.machineState}`)
    switch (state.machineState) {
        case MachineState.TakingShares: {
            const shareable = shareableRailroads(state)
            const railroadId =
                steering.sharePreference(state).find((wanted) => shareable.includes(wanted)) ??
                shareable[0]
            return { type: ActionType.TakeShare, playerId, railroadId }
        }
        case MachineState.Building: {
            const placement = steeredPlacement(state, playerId, steering)
            return placement
                ? {
                      type: ActionType.PlaceLocomotive,
                      playerId,
                      railroadId: placement.railroadId,
                      hexId: placement.hexId
                  }
                : { type: ActionType.EndBuilding, playerId }
        }
        case MachineState.Riding:
            return journeyOrPass(state, playerId)
        default:
            throw new Error(`No user action in ${state.machineState}`)
    }
}

export type SteeredGame = {
    state: HydratedRideTheRailsGameState
    // Every user action with its cascade, in the order played.
    actionRuns: ActionRun[]
}

// Plays ordinary user actions through the engine until the game ends.
export function playToEnd(
    start: HydratedRideTheRailsGameState,
    steering: Steering,
    actionCap = 2000
): SteeredGame {
    const actionRuns: ActionRun[] = []
    let state = start
    while (state.result === undefined) {
        if (actionRuns.length >= actionCap) {
            throw new Error(`The game did not end within ${actionCap} user actions`)
        }
        const actionRun = runAction(state, steeredAction(state, steering))
        actionRuns.push(actionRun)
        state = hydrated(actionRun.after)
    }
    return { state, actionRuns }
}
