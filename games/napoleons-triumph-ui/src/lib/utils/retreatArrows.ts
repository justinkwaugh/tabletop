import type { Point } from '@tabletop/common'
import { LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
import { strokeOutline } from './convexOutline.js'
import { cornersOf, squareAround } from './orientedBox.js'

export const COUNT_RADIUS = 17
export const COUNT_EDGE = 2
const TAIL_SHARE = 0.3
const TIP_SHARE = 0.8
const HEAD_LENGTH = 18
const SHAFT_HALF_WIDTH = 5
const HEAD_HALF_WIDTH = 13

export interface RetreatArrow {
    locale: number
    unitCount: number
    start: Point
    end: Point
    angle: number
    path: string
}

function pathAlong(length: number): string {
    const tail = length * TAIL_SHARE
    const tip = length * TIP_SHARE
    const neck = tip - HEAD_LENGTH
    return `M${tail} ${-SHAFT_HALF_WIDTH} H${neck} V${-HEAD_HALF_WIDTH} L${tip} 0 L${neck} ${HEAD_HALF_WIDTH} V${SHAFT_HALF_WIDTH} H${tail} Z`
}

export function retreatArrows(
    from: number,
    destinations: Readonly<Record<string, number>>
): RetreatArrow[] {
    const unitCounts = new Map<number, number>()
    for (const locale of Object.values(destinations)) {
        unitCounts.set(locale, (unitCounts.get(locale) ?? 0) + 1)
    }
    const start = LOCALE_GEOMETRY[from].anchor
    return [...unitCounts].map(([locale, unitCount]) => {
        const end = LOCALE_GEOMETRY[locale].anchor
        return {
            locale,
            unitCount,
            start,
            end,
            angle: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
            path: pathAlong(Math.hypot(end.x - start.x, end.y - start.y))
        }
    })
}

/** The arrow's shaft and head, and the disc with its count at the destination. */
export function retreatArrowOutlines(arrow: RetreatArrow): Point[][] {
    const length = Math.hypot(arrow.end.x - arrow.start.x, arrow.end.y - arrow.start.y)
    const along = (reach: number, aside = 0): Point => {
        const radians = (arrow.angle * Math.PI) / 180
        const x = Math.cos(radians)
        const y = Math.sin(radians)
        return {
            x: arrow.start.x + x * reach - y * aside,
            y: arrow.start.y + y * reach + x * aside
        }
    }
    const tip = length * TIP_SHARE
    const neck = tip - HEAD_LENGTH
    return [
        strokeOutline(along(length * TAIL_SHARE), along(neck), SHAFT_HALF_WIDTH),
        [along(neck, -HEAD_HALF_WIDTH), along(tip), along(neck, HEAD_HALF_WIDTH)],
        cornersOf(squareAround(arrow.end, COUNT_RADIUS + COUNT_EDGE / 2))
    ]
}
