import type { BoundingBox, Point, RectangleDimensions } from '@tabletop/common'
import { WallSide, type WallSection } from '@tabletop/medina'
import { VIEW_AXES, type BoardView } from '$lib/art/sprites.js'

export const UNITS_PER_CELL = 100

export type BoardProjection = {
    view: BoardView
    sideways: boolean
    size: RectangleDimensions
}

export function worldOfSpace(space: Point, size: RectangleDimensions): Point {
    return { x: space.x + 0.5 - size.width / 2, y: size.height / 2 - space.y - 0.5 }
}

const WALL_OFFSET = 0.32
const TOWER_OFFSET = 0.39

export function worldOfWall(section: WallSection, size: RectangleDimensions): Point {
    const halfWidth = size.width / 2
    const halfHeight = size.height / 2
    switch (section.side) {
        case WallSide.North:
            return { x: section.position + 0.5 - halfWidth, y: halfHeight + WALL_OFFSET }
        case WallSide.South:
            return { x: section.position + 0.5 - halfWidth, y: -halfHeight - WALL_OFFSET }
        case WallSide.West:
            return { x: -halfWidth - WALL_OFFSET, y: halfHeight - section.position - 0.5 }
        case WallSide.East:
            return { x: halfWidth + WALL_OFFSET, y: halfHeight - section.position - 0.5 }
    }
}

export function towerWorlds(size: RectangleDimensions): Point[] {
    const x = size.width / 2 + TOWER_OFFSET
    const y = size.height / 2 + TOWER_OFFSET
    return [
        { x: -x, y },
        { x, y },
        { x: -x, y: -y },
        { x, y: -y }
    ]
}

export function isWallAcross(section: WallSection, sideways: boolean): boolean {
    const runsAlongX = section.side === WallSide.North || section.side === WallSide.South
    return runsAlongX !== sideways
}

function turned(world: Point, sideways: boolean): Point {
    return sideways ? { x: -world.y, y: world.x } : world
}

export function projectView(projection: BoardProjection, view: Point, height = 0): Point {
    const [right, up] = VIEW_AXES[projection.view]
    return {
        x: UNITS_PER_CELL * (right[0] * view.x + right[1] * view.y + right[2] * height),
        y: -UNITS_PER_CELL * (up[0] * view.x + up[1] * view.y + up[2] * height)
    }
}

export function project(projection: BoardProjection, world: Point, height = 0): Point {
    return projectView(projection, turned(world, projection.sideways), height)
}

// Lays art drawn in cell units, y down, flat on the board and upright on screen.
export function uprightMatrix(projection: BoardProjection, view: Point): string {
    const [right, up] = VIEW_AXES[projection.view]
    const origin = projectView(projection, view)
    return `matrix(${UNITS_PER_CELL * right[0]} ${-UNITS_PER_CELL * up[0]} ${-UNITS_PER_CELL * right[1]} ${UNITS_PER_CELL * up[1]} ${origin.x} ${origin.y})`
}

export function footprint(
    projection: BoardProjection,
    world: Point,
    halfX: number,
    halfY: number,
    height = 0
): Point[] {
    return [
        { x: world.x - halfX, y: world.y - halfY },
        { x: world.x + halfX, y: world.y - halfY },
        { x: world.x + halfX, y: world.y + halfY },
        { x: world.x - halfX, y: world.y + halfY }
    ].map((corner) => project(projection, corner, height))
}

function cross(origin: Point, a: Point, b: Point): number {
    return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x)
}

export function convexHull(points: Point[]): Point[] {
    const sorted = points.toSorted((a, b) => a.x - b.x || a.y - b.y)
    const halfHull = (ordered: Point[]) => {
        const hull: Point[] = []
        for (const point of ordered) {
            while (
                hull.length > 1 &&
                cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0
            ) {
                hull.pop()
            }
            hull.push(point)
        }
        hull.pop()
        return hull
    }
    return [...halfHull(sorted), ...halfHull(sorted.toReversed())]
}

export function polygonPoints(points: Point[]): string {
    return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
}

// Wide enough on both sides for the towers' full lean to the left.
const SIDEWAYS_MARGIN = 1.3
const SIDEWAYS_TOP_BAND = 2.6
const SIDEWAYS_BOTTOM_BAND = 2.45
export const SIDEWAYS_CONTROLS_ROOM = 1.9

// On a phone the city turns sideways to fill the width, with a band above and below it for the tiles.
export function croppedToCity(projection: BoardProjection): BoundingBox {
    const { size } = projection
    const left = projectView(projection, {
        x: -size.height / 2 - SIDEWAYS_MARGIN,
        y: size.width / 2 + SIDEWAYS_TOP_BAND
    })
    const right = projectView(projection, {
        x: size.height / 2 + SIDEWAYS_MARGIN,
        y: -size.width / 2 - SIDEWAYS_BOTTOM_BAND
    })
    return { x: left.x, y: left.y, width: right.x - left.x, height: right.y - left.y }
}
