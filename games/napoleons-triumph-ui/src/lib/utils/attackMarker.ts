import type { Point } from '@tabletop/common'
import type { ApproachGeometry } from '$lib/map/boardGeometry.js'

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
export const FEINT_ARROW_PATH =
    `M${-TIP} 0 L${-NECK} ${-HEAD_HALF_WIDTH} V${-SHAFT_HALF_WIDTH} H${CURL_INNER} ` +
    `${CURL_FOLD} ${CURL_OUTER} ${CURL_LIFT} V-7 A19 19 0 0 1 ${CURL_OUTER - 19} ${SHAFT_HALF_WIDTH} ` +
    `H${-NECK} V${HEAD_HALF_WIDTH} Z`
export const FEINT_ARROW_FOLD_PATH =
    `M${CURL_INNER} ${-SHAFT_HALF_WIDTH} V${CURL_TOP} ` +
    `C${CURL_INNER + 6} ${CURL_TOP} ${CURL_OUTER} ${CURL_TOP + 4} ${CURL_OUTER} ${CURL_LIFT} ` +
    `Q${CURL_INNER + 8} ${-SHAFT_HALF_WIDTH - 1} ${CURL_INNER} ${-SHAFT_HALF_WIDTH} Z`

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
