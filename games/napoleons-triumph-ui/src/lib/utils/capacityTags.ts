import type { BoundingBox, Point } from '@tabletop/common'
import { CAPACITY_BOXES, CAPACITY_BOX_SIZE, LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
import { boundsOfPoints, boxHolds, boxesOverlap } from './boundingBox.js'
import {
    grownBySquare,
    outlineHolds,
    outlinesOverlap,
    type ConvexOutline
} from './convexOutline.js'
import { cornersOf, squareAround, type OrientedBox } from './orientedBox.js'
import { insidePolygon } from './polygon.js'

// Larger than the printed box, so the number reads as easily as a flag's.
export const CAPACITY_SQUARE_SIZE = 15
export const CAPACITY_TAG_SIZE = CAPACITY_SQUARE_SIZE + 4
export const CAPACITY_FONT_SIZE = 11
const CLEAR_OF_OBSTACLES = 1.5
const SEARCH_STEP = 3

export interface CapacityTag {
    locale: number
    capacity: number
    centre: Point
    moved: boolean
    crossesBorder: boolean
    cover: OrientedBox
}

interface Obstacle {
    outline: ConvexOutline
    bounds: BoundingBox
}

function blocked(corners: Point[], obstacles: readonly Obstacle[]): boolean {
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
    halfSize: number,
    obstacles: readonly Obstacle[]
): { centre: Point; crossesBorder: boolean } | undefined {
    const outline = LOCALE_GEOMETRY[locale].outline
    const bounds = boundsOfPoints(outline)
    // Grown by the tag once, each obstacle then rules a candidate out by its centre alone.
    const forbidden = obstacles
        .filter((obstacle) => boxesOverlap(bounds, obstacle.bounds))
        .map(({ outline: covering }) => {
            const grown = grownBySquare(covering, halfSize + CLEAR_OF_OBSTACLES)
            return { outline: grown, bounds: boundsOfPoints(grown) }
        })
    const clear = (centre: Point) =>
        !forbidden.some(
            (zone) => boxHolds(zone.bounds, centre) && outlineHolds(zone.outline, centre)
        )
    const room = {
        x: bounds.x + halfSize,
        y: bounds.y + halfSize,
        width: bounds.width - halfSize * 2,
        height: bounds.height - halfSize * 2
    }
    const wholeRoom =
        room.width >= 0 && room.height >= 0
            ? nearestFitting(
                  printedAt,
                  bounds,
                  (centre) =>
                      boxHolds(room, centre) &&
                      clear(centre) &&
                      holds(outline, cornersOf(squareAround(centre, halfSize)))
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

// A tag kept inside its locale is never read as a neighbour's, so it needs no line back to its box.
// Where the locale has no room it stays on its box: a capacity over a piece is better than none.
export function capacityTags(
    capacityOf: (locale: number) => number,
    {
        allShown,
        scale,
        obstacles
    }: { allShown: boolean; scale: number; obstacles: readonly ConvexOutline[] }
): CapacityTag[] {
    const measured = obstacles.map((outline) => ({ outline, bounds: boundsOfPoints(outline) }))
    const halfSize = (CAPACITY_TAG_SIZE / 2) * scale
    return Object.entries(CAPACITY_BOXES).flatMap(([key, printedAt]) => {
        const locale = Number(key)
        const covered = blocked(cornersOf(squareAround(printedAt, CAPACITY_BOX_SIZE / 2)), measured)
        if (!allShown && !covered) {
            return []
        }
        const roomOnTheBox = !blocked(
            cornersOf(squareAround(printedAt, halfSize + CLEAR_OF_OBSTACLES)),
            measured
        )
        const moved = roomOnTheBox ? undefined : clearSpot(locale, printedAt, halfSize, measured)
        const centre = moved?.centre ?? printedAt
        return [
            {
                locale,
                capacity: capacityOf(locale),
                centre,
                moved: moved !== undefined,
                crossesBorder: moved?.crossesBorder ?? false,
                cover: squareAround(centre, halfSize)
            }
        ]
    })
}
