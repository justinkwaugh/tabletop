import type { Point } from '@tabletop/common'
import { cornersOf, squareAround } from './orientedBox.js'

/** How far from the sign's centre the arrow's centre line reaches. */
export const WAY_SIGN_REACH = 27
export const WAY_SIGN_SHAFT_WIDTH = 12
/** The light edge round the sign's arrow, and how far its tap area reaches beyond the arrow. */
export const WAY_SIGN_EDGE = 3
const HEAD_LENGTH = 21
const HEAD_HALF_WIDTH = 15
const SHAFT_INTO_HEAD = 6

export const WAY_SIGN_HEAD = `M0 0 L${-HEAD_LENGTH} ${-HEAD_HALF_WIDTH} L${-HEAD_LENGTH} ${HEAD_HALF_WIDTH} Z`

/** A curved arrow: the shaft runs from the tail to its end, bowing towards the knee, and the head points along the last of it. */
export interface WaySignArrow {
    tail: Point
    knee: Point
    shaftEnd: Point
    tip: Point
    /** Direction of the head in degrees, clockwise from the x axis. */
    angle: number
}

function towards(from: Point, to: Point): Point | undefined {
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    return length === 0 ? undefined : { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
}

/** A curve bowing between two equal arms from its knee, sized so that the smallest circle around it has the sign's reach: how long each arm is, and how far that circle's centre lies from the knee along the sum of the arms' directions. */
function fitted(cosineOfTurn: number): { arm: number; centreAlongArms: number } {
    const sine = Math.sqrt((1 - cosineOfTurn) / 2)
    const cosine = Math.sqrt((1 + cosineOfTurn) / 2)
    if (sine >= cosine / 2) {
        const arm = WAY_SIGN_REACH / sine
        return { arm, centreAlongArms: arm / 2 }
    }
    const arm = (WAY_SIGN_REACH * cosine) / (sine * sine + (cosine * cosine) / 4)
    return { arm, centreAlongArms: arm / 4 + WAY_SIGN_REACH / (2 * cosine) }
}

/** The arrow of a road-choice sign, about the sign's own centre: in from where the march comes, curving out towards where it goes on, as large as the sign's reach allows and centred in it. With one of the two unknown it runs straight. */
export function waySignArrow(
    at: Point,
    comesFrom: Point | undefined,
    goesOnTo: Point | undefined
): WaySignArrow {
    const back = comesFrom && towards(at, comesFrom)
    const onwards = (goesOnTo && towards(at, goesOnTo)) ??
        (back && { x: -back.x, y: -back.y }) ?? { x: 1, y: 0 }
    const backwards = back ?? { x: -onwards.x, y: -onwards.y }
    const { arm, centreAlongArms } = fitted(backwards.x * onwards.x + backwards.y * onwards.y)
    const knee = {
        x: -(backwards.x + onwards.x) * centreAlongArms,
        y: -(backwards.y + onwards.y) * centreAlongArms
    }
    const along = (direction: Point, distance: number): Point => ({
        x: knee.x + direction.x * distance,
        y: knee.y + direction.y * distance
    })
    return {
        tail: along(backwards, arm),
        knee,
        shaftEnd: along(onwards, arm - HEAD_LENGTH + SHAFT_INTO_HEAD),
        tip: along(onwards, arm),
        angle: (Math.atan2(onwards.y, onwards.x) * 180) / Math.PI
    }
}

/** All the sign can cover: the circle of its tap area, which holds the arrow and its edge. */
export function waySignOutline(at: Point, scale: number): Point[] {
    return cornersOf(squareAround(at, (WAY_SIGN_REACH + WAY_SIGN_EDGE) * scale))
}
