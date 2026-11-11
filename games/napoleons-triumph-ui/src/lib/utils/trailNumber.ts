import type { Point } from '@tabletop/common'
import { cornersOf, squareAround } from './orientedBox.js'

const NUMBER_SIZE = 26
const CLEAR_OF_THE_SHAFT = 11

export interface TrailNumber {
    at: Point
    size: number
}

/** Where the number of a trail stands and how large, growing as the flags do when the board is seen from far off. */
export function numberOfTrail(trail: { middle: Point; aside: Point }, scale: number): TrailNumber {
    const size = NUMBER_SIZE * scale
    const reach = CLEAR_OF_THE_SHAFT + size * 0.5
    return {
        at: {
            x: trail.middle.x + trail.aside.x * reach,
            y: trail.middle.y + trail.aside.y * reach
        },
        size
    }
}

/** Room for a number of up to two digits with its light edge. */
export function trailNumberOutline(number: TrailNumber): Point[] {
    return cornersOf(squareAround(number.at, number.size * 0.7))
}
