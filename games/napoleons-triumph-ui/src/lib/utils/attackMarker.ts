import type { Point } from '@tabletop/common'
import { APPROACH_GEOMETRY, type ApproachGeometry } from '$lib/map/boardGeometry.js'
import { aroundArc, grownOutline, type ConvexOutline } from './convexOutline.js'

const TAIL = -24
const NECK = 2
const TIP = 28
const SHAFT_HALF_WIDTH = 12
const HEAD_HALF_WIDTH = 24
const SAMPLE_STEP = 6

export const ATTACK_ARROW_PATH = `M${TAIL} ${-SHAFT_HALF_WIDTH} H${NECK} V${-HEAD_HALF_WIDTH} L${TIP} 0 L${NECK} ${HEAD_HALF_WIDTH} V${SHAFT_HALF_WIDTH} H${TAIL} Z`

/**
 * An attack called off as a feint: the attack's own arrow, straight, turned to point back at the
 * attacker, with the end of its shaft curled up like the end of a ribbon. The curl is a narrow band
 * half the shaft's width, and inside it the ribbon shows its other side.
 */
const CURL_INNER = NECK + 6
const CURL_OUTER = CURL_INNER + SHAFT_HALF_WIDTH
const CURL_LIFT = -SHAFT_HALF_WIDTH - 8
const CURL_TOP = -SHAFT_HALF_WIDTH - 19
const CURL_FOLD = `Q${CURL_INNER + 8} ${-SHAFT_HALF_WIDTH - 1}`
const BEND_RADIUS = 19
const BEND_CENTRE = { x: CURL_OUTER - BEND_RADIUS, y: SHAFT_HALF_WIDTH - BEND_RADIUS }
export const FEINT_ARROW_PATH =
    `M${-TIP} 0 L${-NECK} ${-HEAD_HALF_WIDTH} V${-SHAFT_HALF_WIDTH} H${CURL_INNER} ` +
    `${CURL_FOLD} ${CURL_OUTER} ${CURL_LIFT} V${BEND_CENTRE.y} ` +
    `A${BEND_RADIUS} ${BEND_RADIUS} 0 0 1 ${BEND_CENTRE.x} ${SHAFT_HALF_WIDTH} ` +
    `H${-NECK} V${HEAD_HALF_WIDTH} Z`
export const FEINT_ARROW_FOLD_PATH =
    `M${CURL_INNER} ${-SHAFT_HALF_WIDTH} V${CURL_TOP} ` +
    `C${CURL_INNER + 6} ${CURL_TOP} ${CURL_OUTER} ${CURL_TOP + 4} ${CURL_OUTER} ${CURL_LIFT} ` +
    `Q${CURL_INNER + 8} ${-SHAFT_HALF_WIDTH - 1} ${CURL_INNER} ${-SHAFT_HALF_WIDTH} Z`

/**
 * A counter-attack: a narrower arrow beside the attack's own, pointing back the way the attack came.
 * It is drawn pointing forward, for the marker to turn round, and the two stand side by side about
 * the middle of the bar.
 */
const COUNTER_SHAFT_HALF_WIDTH = 6
const COUNTER_HEAD_HALF_WIDTH = 14
const BETWEEN_THE_ARROWS = 5
export const COUNTER_ARROW_PATH = `M${TAIL} ${-COUNTER_SHAFT_HALF_WIDTH} H${NECK} V${-COUNTER_HEAD_HALF_WIDTH} L${TIP} 0 L${NECK} ${COUNTER_HEAD_HALF_WIDTH} V${COUNTER_SHAFT_HALF_WIDTH} H${TAIL} Z`
const PAIR_HALF_WIDTH = HEAD_HALF_WIDTH + BETWEEN_THE_ARROWS / 2 + COUNTER_HEAD_HALF_WIDTH
export const ATTACK_ARROW_ASIDE = HEAD_HALF_WIDTH - PAIR_HALF_WIDTH
export const COUNTER_ARROW_ASIDE = PAIR_HALF_WIDTH - COUNTER_HEAD_HALF_WIDTH

export interface ArrowDrawing {
    feint: boolean
    countered: boolean
}

export const THREAT_ARROW: ArrowDrawing = { feint: false, countered: false }

export const ARROW_EDGE_WIDTH = 2.5
const EDGE_OUTSIDE = ARROW_EDGE_WIDTH / 2

function block(back: number, front: number, halfWidth: number): Point[] {
    return [
        { x: back, y: -halfWidth },
        { x: front, y: -halfWidth },
        { x: front, y: halfWidth },
        { x: back, y: halfWidth }
    ]
}

function head(neck: number, tip: number, halfWidth: number): Point[] {
    return [
        { x: neck, y: -halfWidth },
        { x: tip, y: 0 },
        { x: neck, y: halfWidth }
    ]
}

/** The arrows' shapes as convex pieces, in the frame they are drawn in: x forward, y across. */
const ATTACK_PIECES: ConvexOutline[] = [
    block(TAIL, NECK, SHAFT_HALF_WIDTH),
    head(NECK, TIP, HEAD_HALF_WIDTH)
]
const FEINT_PIECES: ConvexOutline[] = [
    head(-NECK, -TIP, HEAD_HALF_WIDTH),
    [
        { x: -NECK, y: -SHAFT_HALF_WIDTH },
        { x: CURL_OUTER, y: -SHAFT_HALF_WIDTH },
        ...aroundArc(BEND_CENTRE, BEND_RADIUS, 0, 90, 2),
        { x: -NECK, y: SHAFT_HALF_WIDTH }
    ],
    [
        { x: CURL_INNER, y: -SHAFT_HALF_WIDTH },
        { x: CURL_INNER, y: CURL_TOP },
        { x: CURL_INNER + 6, y: CURL_TOP },
        { x: CURL_OUTER, y: CURL_TOP + 4 },
        { x: CURL_OUTER, y: -SHAFT_HALF_WIDTH }
    ]
]
const COUNTER_PIECES: ConvexOutline[] = [
    block(TAIL, NECK, COUNTER_SHAFT_HALF_WIDTH),
    head(NECK, TIP, COUNTER_HEAD_HALF_WIDTH)
].map((piece) => piece.map(({ x, y }) => ({ x: -x, y: COUNTER_ARROW_ASIDE - y })))

function piecesOf({ feint, countered }: ArrowDrawing): ConvexOutline[] {
    const own = feint ? FEINT_PIECES : ATTACK_PIECES
    return countered
        ? [
              ...own.map((piece) => piece.map(({ x, y }) => ({ x, y: y + ATTACK_ARROW_ASIDE }))),
              ...COUNTER_PIECES
          ]
        : own
}

/** The convex pieces on the board that the arrows drawn on an approach cover, edge included. */
export function arrowOutlines(
    approach: number,
    scale: number,
    drawing: ArrowDrawing
): ConvexOutline[] {
    const bar = APPROACH_GEOMETRY[approach]
    const radians = (attackMarkerAngle(bar) * Math.PI) / 180
    const [cos, sin] = [Math.cos(radians), Math.sin(radians)]
    return piecesOf(drawing).map((piece) =>
        grownOutline(piece, EDGE_OUTSIDE).map(({ x, y }) => ({
            x: bar.centre.x + (x * cos - y * sin) * scale,
            y: bar.centre.y + (x * sin + y * cos) * scale
        }))
    )
}

export function attackMarkerScale(zoom: number): number {
    return Math.min(3.4, Math.max(1.2, 0.7 / zoom))
}

export function attackMarkerAngle(bar: ApproachGeometry): number {
    return (Math.atan2(-bar.inward.y, -bar.inward.x) * 180) / Math.PI
}

function halfWidthAt(reach: number): number {
    return reach <= NECK ? SHAFT_HALF_WIDTH : (HEAD_HALF_WIDTH * (TIP - reach)) / (TIP - NECK)
}

export function attackMarkerSamples(bar: ApproachGeometry, scale: number): Point[] {
    const radians = (attackMarkerAngle(bar) * Math.PI) / 180
    const forward = { x: Math.cos(radians), y: Math.sin(radians) }
    const sideways = { x: -forward.y, y: forward.x }
    const samples: Point[] = []
    for (let reach = TAIL; reach <= TIP; reach += SAMPLE_STEP) {
        const halfWidth = halfWidthAt(reach)
        for (let offset = -halfWidth; offset <= halfWidth; offset += SAMPLE_STEP) {
            samples.push({
                x: bar.centre.x + (forward.x * reach + sideways.x * offset) * scale,
                y: bar.centre.y + (forward.y * reach + sideways.y * offset) * scale
            })
        }
    }
    return samples
}
