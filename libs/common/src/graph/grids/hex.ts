import { BaseCoordinatedGraph, CoordinatedGraph, CoordinatedNode } from '../coordinatedGraph.js'
import { AxialCoordinates } from '../coordinates.js'
import { FlatHexDirection, isPointyHexDirection, PointyHexDirection } from '../directions.js'

export enum HexOrientation {
    PointyTop = 'pointy-top',
    FlatTop = 'flat-top'
}

export type HexGridNode = CoordinatedNode<AxialCoordinates>

export class HexGrid<T extends HexGridNode = HexGridNode>
    extends BaseCoordinatedGraph<T, AxialCoordinates>
    implements CoordinatedGraph<T, AxialCoordinates>
{
    orientation: HexOrientation

    constructor({ orientation }: { orientation: HexOrientation }) {
        super()
        this.orientation = orientation
    }

    neighborAt(
        coords: AxialCoordinates,
        direction: PointyHexDirection | FlatHexDirection
    ): T | undefined {
        const node = this.nodeAt(coords)
        if (!node) {
            return undefined
        }
        return this.neighborOf(node, direction)
    }

    neighborOf(node: T, direction: PointyHexDirection | FlatHexDirection): T | undefined {
        const neighborCoords = this.neighborCoords(node.coords, direction)
        return this.nodeAt(neighborCoords)
    }

    override neighborsAt(
        coords: AxialCoordinates,
        direction?: PointyHexDirection | FlatHexDirection
    ): T[] {
        const node = this.nodeAt(coords)
        if (!node) {
            return []
        }
        return this.neighborsOf(node, direction)
    }

    override neighborsOf(node: T, direction?: PointyHexDirection | FlatHexDirection): T[] {
        if (direction) {
            const neighborCoords = this.neighborCoords(node.coords, direction)
            const neighbor = this.nodeAt(neighborCoords)
            return neighbor ? [neighbor] : []
        } else {
            const neighborDirections =
                this.orientation === HexOrientation.PointyTop
                    ? PointyHexDirection
                    : FlatHexDirection
            return Object.values(neighborDirections)
                .map((direction) => this.neighborCoords(node.coords, direction))
                .map((coords) => this.nodeAt(coords))
                .filter((n) => n !== undefined)
        }
    }

    private neighborCoords(
        coords: AxialCoordinates,
        direction: PointyHexDirection | FlatHexDirection
    ): AxialCoordinates {
        if (this.orientation === HexOrientation.PointyTop && isPointyHexDirection(direction)) {
            return addAxial(coords, PointyNeighborOffsets[direction])
        }
        if (this.orientation === HexOrientation.FlatTop && !isPointyHexDirection(direction)) {
            return addAxial(coords, FlatNeighborOffsets[direction])
        }

        throw new Error(
            `Invalid direction ${direction} for hex grid with orientation ${this.orientation}`
        )
    }
}

export const PointyNeighborOffsets: Record<PointyHexDirection, AxialCoordinates> = {
    [PointyHexDirection.East]: { q: 1, r: 0 }, // East
    [PointyHexDirection.Southeast]: { q: 0, r: 1 }, // Southeast
    [PointyHexDirection.Southwest]: { q: -1, r: 1 }, // Southwest
    [PointyHexDirection.West]: { q: -1, r: 0 }, // West
    [PointyHexDirection.Northwest]: { q: 0, r: -1 }, // Northwest
    [PointyHexDirection.Northeast]: { q: 1, r: -1 } // Northeast
}

export const FlatNeighborOffsets: Record<FlatHexDirection, AxialCoordinates> = {
    [FlatHexDirection.North]: { q: 0, r: -1 }, // North
    [FlatHexDirection.Northeast]: { q: 1, r: -1 }, // Northeast
    [FlatHexDirection.Southeast]: { q: 1, r: 0 }, // Southeast
    [FlatHexDirection.South]: { q: 0, r: 1 }, // South
    [FlatHexDirection.Southwest]: { q: -1, r: 1 }, // Southwest
    [FlatHexDirection.Northwest]: { q: -1, r: 0 } // Northwest
}

export function addAxial(a: AxialCoordinates, b: AxialCoordinates): AxialCoordinates {
    return { q: a.q + b.q, r: a.r + b.r }
}

export function subtractAxial(a: AxialCoordinates, b: AxialCoordinates): AxialCoordinates {
    return { q: a.q - b.q, r: a.r - b.r }
}

export function scaleAxial(coords: AxialCoordinates, factor: number): AxialCoordinates {
    return { q: coords.q * factor, r: coords.r * factor }
}

export function axialDistance(a: AxialCoordinates, b: AxialCoordinates): number {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2
}

export function axialToCube(coords: AxialCoordinates): [number, number, number] {
    const x = coords.q
    const z = coords.r
    const y = -x - z
    return [x, y, z]
}

export function cubeToAxial(cube: [number, number, number]): AxialCoordinates {
    const [x, , z] = cube
    return { q: x, r: z }
}
