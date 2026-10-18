import type { Point } from '@tabletop/common'

export interface OrientedBox {
    centre: Point
    /** Unit vector of the box's length. */
    along: Point
    halfLength: number
    halfWidth: number
}

const SAMPLE_STEP = 8

/** A square standing level on the board, for what is drawn upright in every board view: the board only turns by quarter turns. */
export function squareAround(centre: Point, half: number): OrientedBox {
    return { centre, along: { x: 1, y: 0 }, halfLength: half, halfWidth: half }
}

function pointAt(box: OrientedBox, ahead: number, aside: number): Point {
    return {
        x: box.centre.x + box.along.x * ahead - box.along.y * aside,
        y: box.centre.y + box.along.y * ahead + box.along.x * aside
    }
}

export function cornersOf(box: OrientedBox): Point[] {
    const { halfLength, halfWidth } = box
    return [
        pointAt(box, -halfLength, -halfWidth),
        pointAt(box, halfLength, -halfWidth),
        pointAt(box, halfLength, halfWidth),
        pointAt(box, -halfLength, halfWidth)
    ]
}

function stepsThrough(half: number): number[] {
    const count = Math.ceil((half * 2) / SAMPLE_STEP)
    return Array.from({ length: count + 1 }, (_, index) => -half + (half * 2 * index) / count)
}

/** Points on the board that cover the box, for whatever has to keep off it. */
export function boxSamples(box: OrientedBox): Point[] {
    return stepsThrough(box.halfLength).flatMap((ahead) =>
        stepsThrough(box.halfWidth).map((aside) => pointAt(box, ahead, aside))
    )
}
