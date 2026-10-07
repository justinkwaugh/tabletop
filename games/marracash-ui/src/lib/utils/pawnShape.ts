import type { Point } from '@tabletop/common'

export const PawnUnitSize = 18
export const PawnHeight = 25.9
export const PawnWidth = 14

export const PawnClipId = 'marracash-pawn-clip'
export const PawnBodyShadeId = 'marracash-pawn-body-shade'
export const PawnHatShadeId = 'marracash-pawn-hat-shade'
export const PawnBrimShadowId = 'marracash-pawn-brim-shadow'
export const PawnWaistShadeId = 'marracash-pawn-waist-shade'
export const PawnFootShadeId = 'marracash-pawn-foot-shade'
export const PawnGroundShadowId = 'marracash-pawn-ground-shadow'

export const PawnBaseY = PawnHeight / 2
export const PawnTopY = -PawnBaseY

// After the turned wooden figures of the original: a low knob on a thick, mushroom-like hat, a
// short head with soft shoulders beneath it, a groove, then a bell skirt that flares to a lip just
// above the foot.
const Knob = { halfWidth: 2, baseY: -10.9 }
export const PawnBrimY = -5.6
const HeadTop = { x: -3.9, y: -5.4 }
export const PawnWaistY = -1.1
const NeckHalfWidth = 3.6
const LipHalfWidth = 6.4
const LipY = 10.6
const FootHalfWidth = 5.8
const FootTopY = 10.8
const FootCorner = 0.4

// The left half, from the foot up to the knob, as cubic segments; the right half mirrors it.
type Segment = { from: Point; c1: Point; c2: Point; to: Point }

function line(from: Point, to: Point): Segment {
    return { from, c1: from, c2: to, to }
}

function quadratic(from: Point, control: Point, to: Point): Segment {
    const third = (a: number, b: number) => a + ((b - a) * 2) / 3
    return {
        from,
        c1: { x: third(from.x, control.x), y: third(from.y, control.y) },
        c2: { x: third(to.x, control.x), y: third(to.y, control.y) },
        to
    }
}

const LeftHalf: Segment[] = (() => {
    const footBottom = { x: -FootHalfWidth + FootCorner, y: PawnBaseY }
    const footSide = { x: -FootHalfWidth, y: PawnBaseY - FootCorner }
    const footTop = { x: -FootHalfWidth, y: FootTopY }
    const lip = { x: -LipHalfWidth, y: LipY }
    const shoulder = { x: -4.7, y: 1.6 }
    const groove = { x: -NeckHalfWidth, y: PawnWaistY }
    const brimUnder = { x: -5.4, y: PawnBrimY }
    const brimEdge = { x: -7, y: -8 }
    const knob = { x: -Knob.halfWidth, y: Knob.baseY }
    return [
        line({ x: 0, y: PawnBaseY }, footBottom),
        quadratic(footBottom, { x: -FootHalfWidth, y: PawnBaseY }, footSide),
        line(footSide, footTop),
        line(footTop, lip),
        { from: lip, c1: { x: -6.9, y: 8.2 }, c2: { x: -6.1, y: 2.8 }, to: shoulder },
        { from: shoulder, c1: { x: -4.6, y: 0.4 }, c2: { x: -4.3, y: -0.6 }, to: groove },
        { from: groove, c1: { x: -4.3, y: -2.2 }, c2: { x: -4.3, y: -4.2 }, to: HeadTop },
        line(HeadTop, brimUnder),
        { from: brimUnder, c1: { x: -6.6, y: -5.7 }, c2: { x: -7.3, y: -6.6 }, to: brimEdge },
        { from: brimEdge, c1: { x: -6.7, y: -9.9 }, c2: { x: -4.6, y: -10.8 }, to: knob }
    ]
})()

function mirror({ x, y }: Point): Point {
    return { x: -x, y }
}

function cubic({ c1, c2, to }: Segment): string {
    return `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`
}

function pawnOutline(): string {
    const right = LeftHalf.toReversed().map((segment): Segment => ({
        from: mirror(segment.to),
        c1: mirror(segment.c2),
        c2: mirror(segment.c1),
        to: mirror(segment.from)
    }))
    const knobLeft = LeftHalf[LeftHalf.length - 1].to
    return [
        `M 0 ${PawnBaseY}`,
        ...LeftHalf.map(cubic),
        `A ${Knob.halfWidth} ${Knob.baseY - PawnTopY} 0 0 1 ${-knobLeft.x} ${knobLeft.y}`,
        ...right.map(cubic),
        'Z'
    ].join(' ')
}

export const PawnOutline = pawnOutline()

// Where the brim meets the head, drawn as a crease across the figure.
export const PawnBrimCrease = `M -5.4 ${PawnBrimY} Q 0 ${PawnBrimY + 0.7} 5.4 ${PawnBrimY}`
// The step from the skirt's lip in to the foot.
export const PawnLipCrease = `M ${-LipHalfWidth + 0.4} ${LipY + 0.1} Q 0 ${LipY + 0.8} ${LipHalfWidth - 0.4} ${LipY + 0.1}`

export const HistoryPawnHeight = 20
