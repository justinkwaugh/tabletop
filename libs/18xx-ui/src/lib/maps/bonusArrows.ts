import type { Point } from '@tabletop/common'
import type { TileSymbolName } from '../tiles/tileSymbols.js'
import type { MapRoute } from './mapDrawing.js'

/**
 * A board arrow printed beside the map, as 1833NE's route bonus arrows: values by phase band under
 * a heading, pointed at one end or both.
 */
export type MapBonusArrow = {
    id: string
    /** The board arrow's centre in board units. */
    center: Point
    heading: string
    footer: string | BonusArrowFooter
    /** Each value's label, amount and the revenue stage whose colour it takes. */
    values: readonly { label: string; amount: number; stage: string }[]
    /** The pointed ends; a single point's other end is notched, like an arrow's tail. */
    points: 'left' | 'right' | 'both'
    /** The rules' arrows it stands for when it prints several; otherwise its own id. */
    arrowIds?: readonly string[]
}

/** A footer printing a symbol between its words, such as a port city's anchor; ``spoken`` reads it. */
export type BonusArrowFooter = {
    before: string
    symbol: TileSymbolName
    after: string
    spoken: string
}

/** The footer's words, the symbol counted as two letters' room. */
export function bonusArrowFooterText(footer: MapBonusArrow['footer']): string {
    return typeof footer === 'string' ? footer : `${footer.before}    ${footer.after}`
}

/** The colours of the routes its rules' arrows paid, in route order. */
export function payingRouteColors(
    arrow: MapBonusArrow,
    routes: readonly Pick<MapRoute, 'color' | 'bonusArrowIds'>[]
): string[] {
    const arrowIds = arrow.arrowIds ?? [arrow.id]
    return routes.flatMap((route) =>
        route.bonusArrowIds?.some((id) => arrowIds.includes(id)) ? [route.color] : []
    )
}

export type DrawnBonusArrow = MapBonusArrow & { width: number; height: number; outline: string }

const ValueHeight = 14
// A point is an arrowhead, its shoulders standing clear of the board arrow's body; a tail is notched.
const HeadLength = 26
const HeadFlare = 11
const TailNotch = 12
const LongText = 16

function sides(arrow: MapBonusArrow) {
    return { pointsLeft: arrow.points !== 'right', pointsRight: arrow.points !== 'left' }
}

export function drawBonusArrow(arrow: MapBonusArrow): DrawnBonusArrow {
    const width =
        Math.max(arrow.heading.length, bonusArrowFooterText(arrow.footer).length) > LongText
            ? 104
            : 88
    const height = 26 + arrow.values.length * ValueHeight
    const left = -width / 2
    const right = width / 2
    const top = -height / 2
    const bottom = height / 2
    const { pointsLeft, pointsRight } = sides(arrow)
    const outline = [
        `M ${left} ${top}`,
        `L ${right} ${top}`,
        ...(pointsRight
            ? [
                  `L ${right} ${top - HeadFlare}`,
                  `L ${right + HeadLength} 0`,
                  `L ${right} ${bottom + HeadFlare}`
              ]
            : [`L ${right - TailNotch} 0`]),
        `L ${right} ${bottom}`,
        `L ${left} ${bottom}`,
        ...(pointsLeft
            ? [
                  `L ${left} ${bottom + HeadFlare}`,
                  `L ${left - HeadLength} 0`,
                  `L ${left} ${top - HeadFlare}`
              ]
            : [`L ${left + TailNotch} 0`]),
        'Z'
    ].join(' ')
    return { ...arrow, width, height, outline }
}

/** A board arrow's convex outline in board units, its tail notch filled. */
export function bonusArrowHull(arrow: DrawnBonusArrow): Point[] {
    const { x, y } = arrow.center
    const left = x - arrow.width / 2
    const right = x + arrow.width / 2
    const top = y - arrow.height / 2
    const bottom = y + arrow.height / 2
    const { pointsLeft, pointsRight } = sides(arrow)
    const leftFlare = pointsLeft ? HeadFlare : 0
    const rightFlare = pointsRight ? HeadFlare : 0
    return [
        { x: left, y: top - leftFlare },
        { x: right, y: top - rightFlare },
        { x: pointsRight ? right + HeadLength : right, y },
        { x: right, y: bottom + rightFlare },
        { x: left, y: bottom + leftFlare },
        { x: pointsLeft ? left - HeadLength : left, y }
    ]
}

/** The board area a board arrow covers, points included. */
export function bonusArrowBounds(arrow: DrawnBonusArrow) {
    const hull = bonusArrowHull(arrow)
    const xs = hull.map((point) => point.x)
    const ys = hull.map((point) => point.y)
    return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
    }
}

export const BonusArrowValueHeight = ValueHeight
