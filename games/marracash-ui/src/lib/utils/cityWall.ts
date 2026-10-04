import { getPrng, type RandomFunction } from '@tabletop/common'
import { EntranceFountainIds, getFountain } from '@tabletop/marracash'
import {
    BoardHeight,
    BoardWidth,
    gateRect,
    WallThickness,
    type Rect
} from '$lib/utils/boardGeometry.js'
import { mixColors } from '$lib/utils/colorLightness.js'

export const WallMortar = '#5e4630'
export const WallStoneFilterId = 'marracash-wall-stone'
export const PillarSize = 36

const WallSeed = 23
const Courses = 2
const StoneLength = { min: 18, max: 32 }
const MortarGap = 1.6
const StoneColor = '#b08d63'
const StoneShadow = '#4f3a22'
const ToneSpread = 0.14

export type WallStone = Rect & { fill: string }

type Span = { start: number; end: number }
type WallRun = { horizontal: boolean; across: number; span: Span }

function stoneFill(prng: RandomFunction): string {
    const tone = prng() * 2 - 1
    return mixColors(StoneColor, tone > 0 ? '#ffffff' : StoneShadow, Math.abs(tone) * ToneSpread)
}

function subtract(span: Span, gaps: readonly Span[]): Span[] {
    const pieces: Span[] = []
    let start = span.start
    for (const gap of gaps.toSorted((a, b) => a.start - b.start)) {
        if (gap.start > start) pieces.push({ start, end: Math.min(gap.start, span.end) })
        start = Math.max(start, gap.end)
    }
    if (start < span.end) pieces.push({ start, end: span.end })
    return pieces
}

function layCourse(run: WallRun, piece: Span, course: number, prng: RandomFunction): WallStone[] {
    const depth = WallThickness / Courses
    const stones: WallStone[] = []
    let at = piece.start
    let length = course % 2 === 0 ? StoneLength.min : StoneLength.max * 0.6
    while (at < piece.end) {
        const end = Math.min(at + length, piece.end)
        const across = run.across + course * depth
        const fill = stoneFill(prng)
        const along = { start: at + MortarGap / 2, end: end - MortarGap / 2 }
        const width = along.end - along.start
        const height = depth - MortarGap
        stones.push(
            run.horizontal
                ? { x: along.start, y: across + MortarGap / 2, width, height, fill }
                : { x: across + MortarGap / 2, y: along.start, width: height, height: width, fill }
        )
        at = end
        length = StoneLength.min + prng() * (StoneLength.max - StoneLength.min)
    }
    return stones
}

function gatesOn(run: WallRun, gates: readonly Rect[]): Span[] {
    return gates
        .filter((gate) =>
            run.horizontal
                ? gate.y === run.across && gate.height === WallThickness
                : gate.x === run.across && gate.width === WallThickness
        )
        .map((gate) =>
            run.horizontal
                ? { start: gate.x - PillarSize, end: gate.x + gate.width + PillarSize }
                : { start: gate.y - PillarSize, end: gate.y + gate.height + PillarSize }
        )
}

const Gates: readonly Rect[] = EntranceFountainIds.map((fountainId) =>
    gateRect(getFountain(fountainId).coords)
)

function pillarsBeside(gate: Rect): Rect[] {
    const overhang = (PillarSize - WallThickness) / 2
    if (gate.height === WallThickness) {
        const y = gate.y - overhang
        return [
            { x: gate.x - PillarSize, y, width: PillarSize, height: PillarSize },
            { x: gate.x + gate.width, y, width: PillarSize, height: PillarSize }
        ]
    }
    const x = gate.x - overhang
    return [
        { x, y: gate.y - PillarSize, width: PillarSize, height: PillarSize },
        { x, y: gate.y + gate.height, width: PillarSize, height: PillarSize }
    ]
}

export const GatePillars: readonly Rect[] = Gates.flatMap(pillarsBeside)

// Gate floors reach a little into the street so their cobbles meet it without a seam.
const FloorOverlap = 2

function floorOf(gate: Rect): Rect {
    if (gate.height === WallThickness) {
        const top = gate.y === 0
        return {
            ...gate,
            y: top ? gate.y : gate.y - FloorOverlap,
            height: gate.height + FloorOverlap
        }
    }
    const left = gate.x === 0
    return { ...gate, x: left ? gate.x : gate.x - FloorOverlap, width: gate.width + FloorOverlap }
}

export const GateFloors: readonly Rect[] = Gates.map(floorOf)

function layWall(): WallStone[] {
    const prng = getPrng(WallSeed)
    const runs: WallRun[] = [
        { horizontal: true, across: 0, span: { start: 0, end: BoardWidth } },
        {
            horizontal: true,
            across: BoardHeight - WallThickness,
            span: { start: 0, end: BoardWidth }
        },
        {
            horizontal: false,
            across: 0,
            span: { start: WallThickness, end: BoardHeight - WallThickness }
        },
        {
            horizontal: false,
            across: BoardWidth - WallThickness,
            span: { start: WallThickness, end: BoardHeight - WallThickness }
        }
    ]
    return runs.flatMap((run) =>
        subtract(run.span, gatesOn(run, Gates)).flatMap((piece) =>
            Array.from({ length: Courses }, (_, course) =>
                layCourse(run, piece, course, prng)
            ).flat()
        )
    )
}

export const WallStones: readonly WallStone[] = layWall()
