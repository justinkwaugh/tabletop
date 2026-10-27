import { assertExists } from '@tabletop/common'
import type { GameMap } from '../components/maps/gameMap.js'

export type Neighbour = { cityId: string; cost: number }

export class PlayArea {
    readonly cityIds: ReadonlySet<string>
    private readonly neighbours: ReadonlyMap<string, Neighbour[]>
    private readonly distanceCache = new Map<string, Map<string, number>>()

    constructor(map: GameMap, regionIds: readonly string[]) {
        const regions = new Set(regionIds)
        this.cityIds = new Set(
            map.cities.filter((city) => regions.has(city.region)).map((city) => city.id)
        )
        const neighbours = new Map<string, Neighbour[]>([...this.cityIds].map((id) => [id, []]))
        for (const { a, b, cost } of map.connections) {
            if (this.cityIds.has(a) && this.cityIds.has(b)) {
                neighbours.get(a)?.push({ cityId: b, cost })
                neighbours.get(b)?.push({ cityId: a, cost })
            }
        }
        this.neighbours = neighbours
    }

    isAdjacent(a: string, b: string): boolean {
        return (this.neighbours.get(a) ?? []).some((neighbour) => neighbour.cityId === b)
    }

    contains(cityId: string): boolean {
        return this.cityIds.has(cityId)
    }

    distancesFrom(from: string): ReadonlyMap<string, number> {
        const cached = this.distanceCache.get(from)
        if (cached) {
            return cached
        }
        const distances = new Map<string, number>([[from, 0]])
        const settled = new Set<string>()
        while (settled.size < distances.size) {
            let nearest: string | undefined
            for (const [cityId, distance] of distances) {
                if (
                    !settled.has(cityId) &&
                    (nearest === undefined || distance < (distances.get(nearest) ?? Infinity))
                ) {
                    nearest = cityId
                }
            }
            assertExists(nearest, 'Dijkstra needs an unsettled city')
            settled.add(nearest)
            const base = distances.get(nearest) ?? 0
            for (const { cityId, cost } of this.neighbours.get(nearest) ?? []) {
                if (base + cost < (distances.get(cityId) ?? Infinity)) {
                    distances.set(cityId, base + cost)
                }
            }
        }
        this.distanceCache.set(from, distances)
        return distances
    }

    distance(from: string, to: string): number {
        return this.distancesFrom(from).get(to) ?? Infinity
    }

    distanceToAny(from: readonly string[], to: string): number {
        return Math.min(Infinity, ...from.map((cityId) => this.distance(cityId, to)))
    }

    static adjacentRegions(map: GameMap): Map<string, Set<string>> {
        const regionOf = new Map(map.cities.map((city) => [city.id, city.region]))
        const adjacent = new Map<string, Set<string>>(
            map.regions.map((region) => [region.id, new Set()])
        )
        for (const { a, b } of map.connections) {
            const ra = regionOf.get(a)
            const rb = regionOf.get(b)
            if (ra && rb && ra !== rb) {
                adjacent.get(ra)?.add(rb)
                adjacent.get(rb)?.add(ra)
            }
        }
        return adjacent
    }
}

export type ConnectionStep = { cityId: string; connectionCost: number }

/**
 * The cheapest way to add `targets` to `network`, one city at a time. Each new city connects to
 * the network or a city added before it, so the cheapest total is a minimum spanning tree over
 * the network (as one node) and the targets; Prim's order gives a legal sequence that pays it.
 * Without a network the first city costs nothing to connect.
 */
export function connectionPlan(
    area: PlayArea,
    network: readonly string[],
    targets: readonly string[]
): ConnectionStep[] {
    const remaining = [...targets]
    const reach = new Map<string, number>(
        remaining.map((cityId) => [cityId, area.distanceToAny(network, cityId)])
    )
    const reachOf = (cityId: string) => reach.get(cityId) ?? Infinity
    const steps: ConnectionStep[] = []
    while (remaining.length) {
        const cityId = remaining.reduce((best, next) =>
            reachOf(next) < reachOf(best) ? next : best
        )
        remaining.splice(remaining.indexOf(cityId), 1)
        const startsNetwork = network.length === 0 && steps.length === 0
        steps.push({ cityId, connectionCost: startsNetwork ? 0 : reachOf(cityId) })
        for (const other of remaining) {
            reach.set(other, Math.min(reachOf(other), area.distance(cityId, other)))
        }
    }
    return steps
}
