import type { Point } from '@tabletop/common'
import { LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'

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
