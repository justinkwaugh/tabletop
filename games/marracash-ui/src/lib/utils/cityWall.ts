import { EntranceFountainIds, getFountain } from '@tabletop/marracash'
import {
    BoardHeight,
    BoardWidth,
    gateRect,
    WallThickness,
    type Rect
} from '$lib/utils/boardGeometry.js'

export const WallMortar = '#8c4b2e'
export const RammedEarthPatternId = 'marracash-rammed-earth'
export const PillarSize = 36
export const PillarShadowOffset = { x: 3, y: 4 }

export const WallWalkway = '#c47b58'
export const MerlonColor = '#dc9a72'

const MerlonDepth = 11
const MerlonLength = 15
const CrenelGap = 6
const ParapetDepth = 3
const TowerMerlon = 9
const BastionSpacing = 240

type Span = { start: number; end: number }
type WallRun = { horizontal: boolean; across: number; outerAtStart: boolean; span: Span }

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

// Gate floors reach a little into the street so their ground meets it without a seam.
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

const Runs: readonly WallRun[] = [
    { horizontal: true, across: 0, outerAtStart: true, span: { start: 0, end: BoardWidth } },
    {
        horizontal: true,
        across: BoardHeight - WallThickness,
        outerAtStart: false,
        span: { start: 0, end: BoardWidth }
    },
    {
        horizontal: false,
        across: 0,
        outerAtStart: true,
        span: { start: WallThickness, end: BoardHeight - WallThickness }
    },
    {
        horizontal: false,
        across: BoardWidth - WallThickness,
        outerAtStart: false,
        span: { start: WallThickness, end: BoardHeight - WallThickness }
    }
]

function runRect(run: WallRun, along: Span, fromOuter: number, depth: number): Rect {
    const across = run.outerAtStart
        ? run.across + fromOuter
        : run.across + WallThickness - fromOuter - depth
    const length = along.end - along.start
    return run.horizontal
        ? { x: along.start, y: across, width: length, height: depth }
        : { x: across, y: along.start, width: depth, height: length }
}

function merlonSpans(piece: Span): Span[] {
    const length = piece.end - piece.start
    const count = Math.floor((length + CrenelGap) / (MerlonLength + CrenelGap))
    const used = count * MerlonLength + (count - 1) * CrenelGap
    const first = piece.start + (length - used) / 2
    return Array.from({ length: count }, (_, index) => {
        const start = first + index * (MerlonLength + CrenelGap)
        return { start, end: start + MerlonLength }
    })
}

function towerAt(center: { x: number; y: number }): Rect {
    return {
        x: center.x - PillarSize / 2,
        y: center.y - PillarSize / 2,
        width: PillarSize,
        height: PillarSize
    }
}

const CornerTowers: readonly Rect[] = [
    { x: WallThickness / 2, y: WallThickness / 2 },
    { x: BoardWidth - WallThickness / 2, y: WallThickness / 2 },
    { x: WallThickness / 2, y: BoardHeight - WallThickness / 2 },
    { x: BoardWidth - WallThickness / 2, y: BoardHeight - WallThickness / 2 }
].map(towerAt)

function towerSpanOn(run: WallRun, tower: Rect): Span | undefined {
    const [across, length, along, alongLength] = run.horizontal
        ? [tower.y, tower.height, tower.x, tower.width]
        : [tower.x, tower.width, tower.y, tower.height]
    const overlaps = across < run.across + WallThickness && across + length > run.across
    return overlaps ? { start: along, end: along + alongLength } : undefined
}

function overlapsAny(span: Span, others: readonly Span[]): boolean {
    return others.some((other) => span.start < other.end && span.end > other.start)
}

// The medina's ramparts carry square bastions at regular intervals, not only at gates and corners.
function bastionsOn(run: WallRun, fixed: readonly Rect[]): Rect[] {
    const taken = [
        ...gatesOn(run, Gates),
        ...fixed.flatMap((tower) => towerSpanOn(run, tower) ?? [])
    ]
    const middle = run.across + WallThickness / 2
    const bastions: Rect[] = []
    for (
        let at = WallThickness + BastionSpacing;
        at < run.span.end - PillarSize;
        at += BastionSpacing
    ) {
        const span = { start: at - PillarSize, end: at + PillarSize }
        if (overlapsAny(span, taken)) continue
        bastions.push(towerAt(run.horizontal ? { x: at, y: middle } : { x: middle, y: at }))
    }
    return bastions
}

const FixedTowers: readonly Rect[] = [...GatePillars, ...CornerTowers]

export const Towers: readonly Rect[] = [
    ...FixedTowers,
    ...Runs.flatMap((run) => bastionsOn(run, FixedTowers))
]

function wallPieces(run: WallRun): Span[] {
    const towerSpans = Towers.flatMap((tower) => towerSpanOn(run, tower) ?? [])
    return subtract(run.span, [...gatesOn(run, Gates), ...towerSpans])
}

export const WallMerlons: readonly Rect[] = Runs.flatMap((run) =>
    wallPieces(run).flatMap((piece) =>
        merlonSpans(piece).map((span) => runRect(run, span, 0, MerlonDepth))
    )
)

export const WallParapets: readonly Rect[] = Runs.flatMap((run) =>
    wallPieces(run).map((piece) => runRect(run, piece, WallThickness - ParapetDepth, ParapetDepth))
)

export function towerMerlons(tower: Rect): Rect[] {
    const far = tower.width - TowerMerlon
    const mid = far / 2
    return [
        [0, 0],
        [mid, 0],
        [far, 0],
        [0, mid],
        [far, mid],
        [0, far],
        [mid, far],
        [far, far]
    ].map(([dx, dy]) => ({
        x: tower.x + dx,
        y: tower.y + dy,
        width: TowerMerlon,
        height: TowerMerlon
    }))
}

export type BattlementPaths = {
    penumbra: string
    shadow: string
    body: string
    light: string
    shade: string
}

const BattlementShadowOffset = { x: 2, y: 2.5 }
const BattlementPenumbraOffset = { x: 3.2, y: 4 }

function rectPath(rect: Rect, offset = { x: 0, y: 0 }): string {
    const x = rect.x + offset.x
    const y = rect.y + offset.y
    return `M ${x} ${y} h ${rect.width} v ${rect.height} h ${-rect.width} Z`
}

// Raised earth lit from the top-left, drawn as plain shapes rather than a lighting filter so the
// board repaints cheaply: a cast shadow, the block, a lit top and left edge and a shaded bottom
// and right edge. Each list of blocks becomes four paths however many blocks there are.
export function battlementPaths(blocks: readonly Rect[]): BattlementPaths {
    return {
        penumbra: blocks.map((block) => rectPath(block, BattlementPenumbraOffset)).join(' '),
        shadow: blocks.map((block) => rectPath(block, BattlementShadowOffset)).join(' '),
        body: blocks.map((block) => rectPath(block)).join(' '),
        light: blocks
            .map(
                (block) =>
                    `M ${block.x} ${block.y + block.height} V ${block.y} H ${block.x + block.width}`
            )
            .join(' '),
        shade: blocks
            .map(
                (block) =>
                    `M ${block.x + block.width} ${block.y} V ${block.y + block.height} H ${block.x}`
            )
            .join(' ')
    }
}

export const WallBattlements: BattlementPaths = battlementPaths([...WallParapets, ...WallMerlons])
export const TowerBattlements: BattlementPaths = battlementPaths(Towers.flatMap(towerMerlons))
