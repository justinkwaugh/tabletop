import {
    ClockwisePointyHexDirections,
    PointyHexDirection,
    type AxialCoordinates
} from '@tabletop/common'
import { neighborCoords, oppositeDirection, spaceKey } from '../components/boardGrid.js'
import type { PlaceId } from '../components/places.js'
import type { HydratedBoard } from './board.js'

export type Connection = {
    placeIds: [PlaceId, PlaceId]
    roads: AxialCoordinates[]
}

export class Network {
    private neighborsByPlace = new Map<PlaceId, Set<PlaceId>>()

    constructor(readonly connections: Connection[]) {
        for (const { placeIds } of connections) {
            const [a, b] = placeIds
            this.link(a, b)
            this.link(b, a)
        }
    }

    neighbors(placeId: PlaceId): PlaceId[] {
        return [...(this.neighborsByPlace.get(placeId) ?? [])]
    }

    connectionCount(placeId: PlaceId): number {
        return this.neighborsByPlace.get(placeId)?.size ?? 0
    }

    areConnected(a: PlaceId, b: PlaceId): boolean {
        return this.neighborsByPlace.get(a)?.has(b) ?? false
    }

    connectionsOf(placeId: PlaceId): Connection[] {
        return this.connections.filter(({ placeIds }) => placeIds.includes(placeId))
    }

    private link(from: PlaceId, to: PlaceId) {
        const neighbors = this.neighborsByPlace.get(from) ?? new Set<PlaceId>()
        neighbors.add(to)
        this.neighborsByPlace.set(from, neighbors)
    }
}

// Places are directly connected when a chain of joined road tiles runs between them with nothing in
// between; a tile whose end meets anything other than a joining road or a place is a dead end.
export function buildNetwork(board: HydratedBoard): Network {
    const connections: Connection[] = []
    const seenPaths = new Set<string>()

    for (const place of board.places()) {
        for (const space of place.spaces) {
            for (const direction of ClockwisePointyHexDirections) {
                const path = traceRoad(board, space, direction)
                if (!path) {
                    continue
                }
                const target = board.placeAt(path.end)
                if (!target || target.id === place.id) {
                    continue
                }
                const pathKey = path.roads
                    .map(spaceKey)
                    .toSorted((a, b) => a - b)
                    .join('|')
                if (seenPaths.has(pathKey)) {
                    continue
                }
                seenPaths.add(pathKey)
                connections.push({ placeIds: [place.id, target.id], roads: path.roads })
            }
        }
    }
    return new Network(connections)
}

function traceRoad(
    board: HydratedBoard,
    from: AxialCoordinates,
    direction: PointyHexDirection
): { roads: AxialCoordinates[]; end: AxialCoordinates } | undefined {
    let coords = neighborCoords(from, direction)
    let entry = oppositeDirection(direction)
    let road = board.roadAt(coords)
    if (!road || !road.ends.includes(entry)) {
        return undefined
    }
    const roads: AxialCoordinates[] = []
    while (road && road.ends.includes(entry) && roads.length <= board.roads.length) {
        roads.push(coords)
        const exit = road.ends[0] === entry ? road.ends[1] : road.ends[0]
        coords = neighborCoords(coords, exit)
        entry = oppositeDirection(exit)
        road = board.roadAt(coords)
    }
    return { roads, end: coords }
}
