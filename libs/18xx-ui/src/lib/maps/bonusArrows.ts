import type { Point } from '@tabletop/common'

/**
 * A plaque printed beside the board, as 1833NE's route bonus arrows: values by phase band under
 * a heading, pointed at one end or both.
 */
export type MapBonusArrow = {
    id: string
    /** The plaque's centre in board units. */
    center: Point
    heading: string
    footer: string
    /** Each value's label, amount and the revenue stage whose colour it takes. */
    values: readonly { label: string; amount: number; stage: string }[]
    /** The pointed ends; a single point's other end is notched, like an arrow's tail. */
    points: 'left' | 'right' | 'both'
}

export type DrawnBonusArrow = MapBonusArrow & { width: number; height: number; outline: string }

const ValueHeight = 14
const PointLength = 12
const TailNotch = 7
const LongText = 16

export function drawBonusArrow(arrow: MapBonusArrow): DrawnBonusArrow {
    const width = Math.max(arrow.heading.length, arrow.footer.length) > LongText ? 104 : 88
    const height = 26 + arrow.values.length * ValueHeight
    const left = -width / 2
    const right = width / 2
    const top = -height / 2
    const bottom = height / 2
    const pointsLeft = arrow.points !== 'right'
    const pointsRight = arrow.points !== 'left'
    const outline = [
        `M ${left} ${top}`,
        `L ${right} ${top}`,
        `L ${pointsRight ? right + PointLength : right - TailNotch} 0`,
        `L ${right} ${bottom}`,
        `L ${left} ${bottom}`,
        `L ${pointsLeft ? left - PointLength : left + TailNotch} 0 Z`
    ].join(' ')
    return { ...arrow, width, height, outline }
}

/** A plaque's convex outline in board units, its tail notch filled. */
export function bonusArrowHull(arrow: DrawnBonusArrow): Point[] {
    const { x, y } = arrow.center
    const left = x - arrow.width / 2
    const right = x + arrow.width / 2
    const top = y - arrow.height / 2
    const bottom = y + arrow.height / 2
    return [
        { x: left, y: top },
        { x: right, y: top },
        { x: arrow.points === 'left' ? right : right + PointLength, y },
        { x: right, y: bottom },
        { x: left, y: bottom },
        { x: arrow.points === 'right' ? left : left - PointLength, y }
    ]
}

/** The board area a plaque covers, points included. */
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
