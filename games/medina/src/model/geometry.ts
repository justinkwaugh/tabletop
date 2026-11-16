import { samePoint, type Point, type RectangleDimensions } from '@tabletop/common'
import { WallSide } from '../components/pieces.js'

const ORTHOGONAL_STEPS: Point[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
]

export function orthogonalNeighbors(space: Point): Point[] {
    return ORTHOGONAL_STEPS.map((step) => ({ x: space.x + step.x, y: space.y + step.y }))
}

export function distinctSpaces(spaces: Point[]): Point[] {
    return spaces.filter(
        (space, index) => spaces.findIndex((other) => samePoint(other, space)) === index
    )
}

export function areOrthogonallyAdjacent(a: Point, b: Point): boolean {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
}

export function areTouching(a: Point, b: Point): boolean {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1
}

export function isInsideCity(space: Point, size: RectangleDimensions): boolean {
    return space.x >= 0 && space.y >= 0 && space.x < size.width && space.y < size.height
}

export function citySpaces(size: RectangleDimensions): Point[] {
    const spaces: Point[] = []
    for (let y = 0; y < size.height; y++) {
        for (let x = 0; x < size.width; x++) {
            spaces.push({ x, y })
        }
    }
    return spaces
}

export function wallSideLength(side: WallSide, size: RectangleDimensions): number {
    return side === WallSide.North || side === WallSide.South ? size.width : size.height
}

export function sameWall(
    a: { side: WallSide; position: number },
    b: { side: WallSide; position: number }
): boolean {
    return a.side === b.side && a.position === b.position
}

export function spaceBesideWall(
    side: WallSide,
    position: number,
    size: RectangleDimensions
): Point {
    switch (side) {
        case WallSide.North:
            return { x: position, y: 0 }
        case WallSide.South:
            return { x: position, y: size.height - 1 }
        case WallSide.West:
            return { x: 0, y: position }
        case WallSide.East:
            return { x: size.width - 1, y: position }
    }
}
