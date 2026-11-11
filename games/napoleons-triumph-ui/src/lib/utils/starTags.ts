import type { Point, RectangleDimensions } from '@tabletop/common'
import type { Hold, Star, StarHold } from '@tabletop/napoleons-triumph'
import { PRINTED_STARS, STAR_MARK_SIZE } from '$lib/map/boardGeometry.js'
import { boundsOfPoints } from './boundingBox.js'
import type { ConvexOutline } from './convexOutline.js'
import { holdOf, inPrintedOrder } from './objectiveStars.js'
import { cornersOf, levelBoxAround, squareAround, type OrientedBox } from './orientedBox.js'
import { coveredBy, measuredObstacles, placeTag } from './tagPlacement.js'

// Larger than the print, as the capacity tags are, so the colours read as easily as a flag.
export const STAR_TAG_STAR_SIZE = 14
export const STAR_TAG_PITCH = 15
const STAR_TAG_EDGE = 2.5

export interface TaggedStar {
    star: Star
    hold: Hold | undefined
}

export interface StarTag {
    locale: number
    stars: TaggedStar[]
    centre: Point
    moved: boolean
    crossesBorder: boolean
    cover: OrientedBox
}

/** The tag as it lies on the board, its stars one above another as printed. */
export function starTagSize(count: number): RectangleDimensions {
    return {
        width: STAR_TAG_STAR_SIZE + STAR_TAG_EDGE * 2,
        height: (count - 1) * STAR_TAG_PITCH + STAR_TAG_STAR_SIZE + STAR_TAG_EDGE * 2
    }
}

export function printedStarSquare(star: Point): OrientedBox {
    return squareAround(star, STAR_MARK_SIZE / 2)
}

function printedColumn(stars: readonly Point[]): { middle: Point; corners: Point[] } {
    const bounds = boundsOfPoints(stars.flatMap((star) => cornersOf(printedStarSquare(star))))
    const middle = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    return { middle, corners: cornersOf(levelBoxAround(middle, bounds)) }
}

// Capacity tags stand beside nearly every printed star once all capacities are shown, so they are kept clear of without counting as covering the print.
export function starTags(
    starsOf: (locale: number) => readonly Star[],
    holds: readonly StarHold[],
    {
        scale,
        obstacles,
        capacityTags
    }: {
        scale: number
        obstacles: readonly ConvexOutline[]
        capacityTags: readonly ConvexOutline[]
    }
): StarTag[] {
    const measured = measuredObstacles(obstacles)
    const inTheWay = [...measured, ...measuredObstacles(capacityTags)]
    return Object.entries(PRINTED_STARS).flatMap(([key, printed]) => {
        const locale = Number(key)
        const column = printedColumn(printed)
        const stars = inPrintedOrder(starsOf(locale)).map((star) => ({
            star,
            hold: holdOf(holds, star, locale)
        }))
        const held = stars.some(({ hold }) => hold !== undefined)
        if (!held && !coveredBy(column.corners, measured)) {
            return []
        }
        const printedSize = starTagSize(stars.length)
        const onTheBoard = {
            width: printedSize.width * scale,
            height: printedSize.height * scale
        }
        const spot = placeTag(locale, column.middle, onTheBoard, inTheWay)
        return [{ locale, stars, ...spot, cover: levelBoxAround(spot.centre, onTheBoard) }]
    })
}
