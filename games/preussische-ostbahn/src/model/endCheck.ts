import { SpaceKind, mapSpace, neighboringSpaces } from '../components/map.js'
import {
    Ability,
    KOLN_MINDENER_SPENDING_LIMIT,
    railroadDefinition
} from '../components/railroads.js'
import { entryCost } from './expansion.js'
import {
    cubesLeft,
    directConnections,
    hasBuiltApproach,
    occupants,
    unsoldShares
} from './network.js'
import type { RailroadState } from './railroadState.js'

export const CONNECTIONS_TO_END = 2

export function everyRailroadConnected(railroads: readonly RailroadState[]): boolean {
    return railroads.every(
        (railroad) => directConnections(railroads, railroad.id).length >= CONNECTIONS_TO_END
    )
}

// Proves only impossibility: each railroad's reach ignores how the others' future track would
// block it and how its own routes to two partners compete for cubes and money. Costs are the
// cheapest any Expansion could pay, since City Penalties only grow, and the Badische's free
// rural track repeats every Expansion.
export function connectionGoalImpossible(railroads: readonly RailroadState[]): boolean {
    const reach = railroads.map((railroad) => reachableCities(railroads, railroad))
    return railroads.some((railroad, index) => {
        const connected = directConnections(railroads, railroad.id)
        const own = reach[index]
        const partners = railroads.filter(
            (other, otherIndex) =>
                other.id !== railroad.id &&
                !connected.includes(other.id) &&
                [...reach[otherIndex]].some((city) => own.has(city))
        )
        return connected.length + partners.length < CONNECTIONS_TO_END
    })
}

type Step = { spaceId: string; approachUsed: boolean }

export function reachableCities(
    railroads: readonly RailroadState[],
    railroad: RailroadState
): Set<string> {
    const ability = railroadDefinition(railroad.id).ability
    const budget = unsoldShares(railroad) > 0 ? Infinity : railroad.treasury
    const stepCost = (spaceId: string) => {
        const space = mapSpace(spaceId)
        if (ability === Ability.FreeRural && space.kind === SpaceKind.Rural) {
            return 0
        }
        const cost = entryCost(railroads, railroad.id, spaceId)
        return ability === Ability.FiveDollarMax && cost > KOLN_MINDENER_SPENDING_LIMIT
            ? Infinity
            : cost
    }
    const key = ({ spaceId, approachUsed }: Step) => `${spaceId}|${approachUsed}`
    const startApproach = hasBuiltApproach(railroad)
    let frontier = new Map<string, Step & { cost: number }>(
        railroad.track.map((spaceId) => {
            const step = { spaceId, approachUsed: startApproach, cost: 0 }
            return [key(step), step]
        })
    )
    const best = new Map(frontier)
    for (let built = 0; built < cubesLeft(railroad); built++) {
        const next = new Map<string, Step & { cost: number }>()
        for (const step of frontier.values()) {
            for (const spaceId of neighboringSpaces(step.spaceId)) {
                if (railroad.track.includes(spaceId)) {
                    continue
                }
                const kind = mapSpace(spaceId).kind
                if (kind !== SpaceKind.City && occupants(railroads, spaceId).length > 0) {
                    continue
                }
                if (kind === SpaceKind.Approach && step.approachUsed) {
                    continue
                }
                const cost = step.cost + stepCost(spaceId)
                if (cost > budget) {
                    continue
                }
                const reached = {
                    spaceId,
                    approachUsed: step.approachUsed || kind === SpaceKind.Approach,
                    cost
                }
                const known = best.get(key(reached))
                if (known === undefined || known.cost > cost) {
                    best.set(key(reached), reached)
                    next.set(key(reached), reached)
                }
            }
        }
        frontier = next
    }
    return new Set(
        [...best.values()]
            .map(({ spaceId }) => spaceId)
            .filter((spaceId) => mapSpace(spaceId).kind === SpaceKind.City)
    )
}
