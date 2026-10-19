import type { BoundingBox, Point, RectangleDimensions } from '@tabletop/common'
import { LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
import { boundsOfPoints, boxHolds, boxesOverlap } from './boundingBox.js'
import {
    grownByLevelBox,
    outlineHolds,
    outlinesOverlap,
    type ConvexOutline
} from './convexOutline.js'
import { cornersOf, levelBoxAround } from './orientedBox.js'
import { insidePolygon } from './polygon.js'

const CLEAR_OF_OBSTACLES = 1.5
const SEARCH_STEP = 3

export interface Obstacle {
    outline: ConvexOutline
    bounds: BoundingBox
}

export interface TagSpot {
    centre: Point
    moved: boolean
    crossesBorder: boolean
}

export function measuredObstacles(outlines: readonly ConvexOutline[]): Obstacle[] {
    return outlines.map((outline) => ({ outline, bounds: boundsOfPoints(outline) }))
}

export function coveredBy(corners: Point[], obstacles: readonly Obstacle[]): boolean {
    const bounds = boundsOfPoints(corners)
    return obstacles.some(
        (obstacle) =>
            boxesOverlap(bounds, obstacle.bounds) && outlinesOverlap(corners, obstacle.outline)
    )
}

function sidesOf(outline: readonly Point[]): Point[][] {
    return outline.map((corner, index) => [corner, outline[(index + 1) % outline.length]])
}

// Corners alone are not enough: a locale's outline can bend in between them.
function holds(outline: readonly Point[], corners: Point[]): boolean {
    return (
        corners.every((corner) => insidePolygon(corner, outline)) &&
        !sidesOf(outline).some((side) => outlinesOverlap(corners, side))
    )
}

// Ring by ring outwards, so the first spot found is about the nearest.
function nearestFitting(
    printedAt: Point,
    bounds: BoundingBox,
    fits: (centre: Point) => boolean
): Point | undefined {
    const farthest = Math.max(
        ...[bounds.x, bounds.x + bounds.width].flatMap((x) =>
            [bounds.y, bounds.y + bounds.height].map((y) =>
                Math.hypot(x - printedAt.x, y - printedAt.y)
            )
        )
    )
    for (let reach = SEARCH_STEP; reach <= farthest; reach += SEARCH_STEP) {
        const count = Math.ceil((2 * Math.PI * reach) / SEARCH_STEP)
        for (let index = 0; index < count; index++) {
            const turn = (2 * Math.PI * index) / count
            const centre = {
                x: printedAt.x + reach * Math.cos(turn),
                y: printedAt.y + reach * Math.sin(turn)
            }
            if (fits(centre)) {
                return centre
            }
        }
    }
    return undefined
}

function clearSpot(
    locale: number,
    printedAt: Point,
    size: RectangleDimensions,
    obstacles: readonly Obstacle[]
): Omit<TagSpot, 'moved'> | undefined {
    const outline = LOCALE_GEOMETRY[locale].outline
    const bounds = boundsOfPoints(outline)
    const halfX = size.width / 2
    const halfY = size.height / 2
    // Grown by the tag once, each obstacle then rules a candidate out by its centre alone.
    const forbidden = obstacles
        .filter((obstacle) => boxesOverlap(bounds, obstacle.bounds))
        .map(({ outline: covering }) => {
            const grown = grownByLevelBox(
                covering,
                halfX + CLEAR_OF_OBSTACLES,
                halfY + CLEAR_OF_OBSTACLES
            )
            return { outline: grown, bounds: boundsOfPoints(grown) }
        })
    const clear = (centre: Point) =>
        !forbidden.some(
            (zone) => boxHolds(zone.bounds, centre) && outlineHolds(zone.outline, centre)
        )
    const room = {
        x: bounds.x + halfX,
        y: bounds.y + halfY,
        width: bounds.width - halfX * 2,
        height: bounds.height - halfY * 2
    }
    const wholeRoom =
        room.width >= 0 && room.height >= 0
            ? nearestFitting(
                  printedAt,
                  bounds,
                  (centre) =>
                      boxHolds(room, centre) &&
                      clear(centre) &&
                      holds(outline, cornersOf(levelBoxAround(centre, size)))
              )
            : undefined
    if (wholeRoom) {
        return { centre: wholeRoom, crossesBorder: false }
    }
    // Zoomed out, a tag grows with the flags until the pieces leave it no whole room: its middle in the locale still names it.
    const middleRoom = nearestFitting(
        printedAt,
        bounds,
        (centre) => boxHolds(bounds, centre) && clear(centre) && insidePolygon(centre, outline)
    )
    return middleRoom ? { centre: middleRoom, crossesBorder: true } : undefined
}

// A tag kept inside its locale is never read as a neighbour's, so it needs no line back to its mark.
// Where the locale has no room it stays on its mark: a mark over a piece is better than none.
export function placeTag(
    locale: number,
    printedAt: Point,
    size: RectangleDimensions,
    obstacles: readonly Obstacle[]
): TagSpot {
    const clearance = {
        width: size.width + CLEAR_OF_OBSTACLES * 2,
        height: size.height + CLEAR_OF_OBSTACLES * 2
    }
    if (!coveredBy(cornersOf(levelBoxAround(printedAt, clearance)), obstacles)) {
        return { centre: printedAt, moved: false, crossesBorder: false }
    }
    const spot = clearSpot(locale, printedAt, size, obstacles)
    return spot
        ? { ...spot, moved: true }
        : { centre: printedAt, moved: false, crossesBorder: false }
}
