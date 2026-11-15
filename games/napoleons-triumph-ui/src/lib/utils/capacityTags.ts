import type { Point } from '@tabletop/common'
import { CAPACITY_BOXES, CAPACITY_BOX_SIZE } from '$lib/map/boardGeometry.js'
import type { ConvexOutline } from './convexOutline.js'
import { cornersOf, squareAround, type OrientedBox } from './orientedBox.js'
import { coveredBy, measuredObstacles, placeTag } from './tagPlacement.js'

// Larger than the printed box, so the number reads as easily as a flag's.
export const CAPACITY_SQUARE_SIZE = 15
export const CAPACITY_TAG_SIZE = CAPACITY_SQUARE_SIZE + 4
export const CAPACITY_FONT_SIZE = 11

export interface CapacityTag {
    locale: number
    capacity: number
    centre: Point
    moved: boolean
    crossesBorder: boolean
    cover: OrientedBox
}

export function capacityTags(
    capacityOf: (locale: number) => number,
    {
        allShown,
        scale,
        obstacles
    }: { allShown: boolean; scale: number; obstacles: readonly ConvexOutline[] }
): CapacityTag[] {
    const measured = measuredObstacles(obstacles)
    const side = CAPACITY_TAG_SIZE * scale
    return Object.entries(CAPACITY_BOXES).flatMap(([key, printedAt]) => {
        const locale = Number(key)
        const covered = coveredBy(
            cornersOf(squareAround(printedAt, CAPACITY_BOX_SIZE / 2)),
            measured
        )
        if (!allShown && !covered) {
            return []
        }
        const spot = placeTag(locale, printedAt, { width: side, height: side }, measured)
        return [
            {
                locale,
                capacity: capacityOf(locale),
                ...spot,
                cover: squareAround(spot.centre, side / 2)
            }
        ]
    })
}
