import type { OffsetCoordinates, Point } from '@tabletop/common'
import {
    BoardColumns,
    BoardRows,
    EntranceFountainIds,
    getFountain,
    getShop,
    startingQueueLength,
    type ShopId
} from '@tabletop/marracash'
import { PawnHeight, PawnUnitSize, PawnWidth } from '$lib/utils/pawnShape.js'

export const CellSize = 80
export const WallThickness = 28
export const BoardWidth = BoardColumns * CellSize + 2 * WallThickness
export const BoardHeight = BoardRows * CellSize + 2 * WallThickness

export const ShopTileInset = 6

export type Rect = Point & { width: number; height: number }

export enum WallSide {
    Top = 'top',
    Left = 'left',
    Bottom = 'bottom',
    Right = 'right'
}

export function cellOrigin(coords: OffsetCoordinates): Point {
    return {
        x: WallThickness + coords.col * CellSize,
        y: WallThickness + coords.row * CellSize
    }
}

export function cellCenter(coords: OffsetCoordinates): Point {
    const origin = cellOrigin(coords)
    return { x: origin.x + CellSize / 2, y: origin.y + CellSize / 2 }
}

export function shopRect(shopId: ShopId, inset: number): Rect {
    const [first, second] = getShop(shopId).cells
    const topLeft = cellOrigin({
        row: Math.min(first.row, second.row),
        col: Math.min(first.col, second.col)
    })
    const rows = Math.abs(first.row - second.row) + 1
    const cols = Math.abs(first.col - second.col) + 1
    return {
        x: topLeft.x + inset,
        y: topLeft.y + inset,
        width: cols * CellSize - 2 * inset,
        height: rows * CellSize - 2 * inset
    }
}

export function wallSideOf(coords: OffsetCoordinates): WallSide {
    if (coords.row === 0) return WallSide.Top
    if (coords.row === BoardRows - 1) return WallSide.Bottom
    if (coords.col === 0) return WallSide.Left
    return WallSide.Right
}

export function clusterPositions(count: number, center: Point, spacing: Point): Point[] {
    const columns = Math.ceil(Math.sqrt(count))
    const rows = Math.ceil(count / columns)
    return Array.from({ length: count }, (_, index) => {
        const row = Math.floor(index / columns)
        const inRow = row === rows - 1 ? count - row * columns : columns
        const col = index % columns
        return {
            x: center.x + (col - (inRow - 1) / 2) * spacing.x,
            y: center.y + (row - (rows - 1) / 2) * spacing.y
        }
    })
}

// Wider than a cell so the gate pillars clear the entrance fountains' number labels.
const GateWidth = CellSize + 28

export function gateRect(coords: OffsetCoordinates): Rect {
    const center = cellCenter(coords)
    switch (wallSideOf(coords)) {
        case WallSide.Top:
            return { x: center.x - GateWidth / 2, y: 0, width: GateWidth, height: WallThickness }
        case WallSide.Bottom:
            return {
                x: center.x - GateWidth / 2,
                y: BoardHeight - WallThickness,
                width: GateWidth,
                height: WallThickness
            }
        case WallSide.Left:
            return { x: 0, y: center.y - GateWidth / 2, width: WallThickness, height: GateWidth }
        case WallSide.Right:
            return {
                x: BoardWidth - WallThickness,
                y: center.y - GateWidth / 2,
                width: WallThickness,
                height: GateWidth
            }
    }
}

export const QueueMargin = 66
export const TableWidth = BoardWidth + 2 * QueueMargin
export const TableHeight = BoardHeight + 2 * QueueMargin

// The towers either side of a gate are this wide, standing just beyond its opening.
export const PillarSize = 36
// The clear space between visitors standing in the queue.
const VisitorGap = 17

// Pawns are drawn standing, so each row is placed by where its feet fall: the top row stands just
// clear of the wall, the bottom row far enough in that the runner under its feet fits the table.
const QueueLane = 26
// The top row stands a little higher, so its runner keeps clear of the wall's battlements.
const QueueTopLane = 21
const QueueBottomLane = TableHeight - 40
const RunnerEndPadding = 12
const LabelGap = 10
const LabelCharWidth = 9.6
const RunnerEdgeClearance = 14
const GateClearance = 6

export const QueuePawnSize = 30
const QueuePawnScale = QueuePawnSize / PawnUnitSize

function labelLength(label: string): number {
    return label.length * LabelCharWidth
}

// The front of the runner comes up to the top gate's opening, so its label and the count waiting
// sit beside the gate visitors enter by. The front label's room is reserved for the longest
// count, so the runner's front end never moves as the queue shortens.
const TopGateOpening =
    QueueMargin +
    Math.min(
        ...EntranceFountainIds.map((id) => getFountain(id).coords)
            .filter((coords) => wallSideOf(coords) === WallSide.Top)
            .map((coords) => gateRect(coords).x)
    )
const FrontLabelRoom = labelLength(
    queueRunnerLabels(startingQueueLength(EntranceFountainIds.length))[0]
)
const FrontReserve = RunnerEndPadding + FrontLabelRoom + LabelGap + (PawnWidth * QueuePawnScale) / 2
const QueueFrontX = TopGateOpening - GateClearance - FrontReserve

// The back runs along the bottom as far as a full queue needs at the usual spacing; only if that
// would run off the table do the visitors stand closer, so "Back" still fits past the last one.
const BackReserve =
    (PawnWidth * QueuePawnScale) / 2 +
    LabelGap +
    labelLength('Back') +
    RunnerEndPadding +
    RunnerEdgeClearance
const RowExtent = PawnWidth * QueuePawnScale
const SideExtent = PawnHeight * QueuePawnScale
const FullQueueIntervals = startingQueueLength(EntranceFountainIds.length) - 1
const RowSlotsBeforeBottom =
    (QueueFrontX - QueueLane) / (RowExtent + VisitorGap) +
    (QueueBottomLane - QueueTopLane) / (SideExtent + VisitorGap)
const QueueBackX = Math.min(
    TableWidth - BackReserve,
    QueueLane + (FullQueueIntervals - RowSlotsBeforeBottom) * (RowExtent + VisitorGap)
)

const QueuePath: Point[] = [
    { x: QueueFrontX, y: QueueTopLane },
    { x: QueueLane, y: QueueTopLane },
    { x: QueueLane, y: QueueBottomLane },
    { x: QueueBackX, y: QueueBottomLane }
]

const SpacingSearchSteps = 50

function segmentLength(segment: number): number {
    return distance(QueuePath[segment - 1], QueuePath[segment])
}

function pawnExtentAlong(segment: number): number {
    const vertical = QueuePath[segment - 1].x === QueuePath[segment].x
    return (vertical ? PawnHeight : PawnWidth) * QueuePawnScale
}

const QueueSegments = QueuePath.slice(1).map((_, index) => ({
    length: segmentLength(index + 1),
    extent: pawnExtentAlong(index + 1)
}))

function slotsAlongQueue(gap: number): number {
    return QueueSegments.reduce(
        (slots, segment) => slots + segment.length / (segment.extent + gap),
        0
    )
}

function evenQueueGap(): number {
    const intervals = startingQueueLength(EntranceFountainIds.length) - 1
    let low = -Math.min(...QueueSegments.map((segment) => segment.extent))
    let high = Math.max(...QueueSegments.map((segment) => segment.length))
    for (let step = 0; step < SpacingSearchSteps; step++) {
        const gap = (low + high) / 2
        if (slotsAlongQueue(gap) > intervals) low = gap
        else high = gap
    }
    return (low + high) / 2
}

const QueueGap = evenQueueGap()

export function pointAtQueueSlot(slot: number): Point {
    return pointAtDistance(distanceAtSlot(slot))
}

function slotsIn(segment: number): number {
    const { length, extent } = QueueSegments[segment - 1]
    return length / (extent + QueueGap)
}

export function distance(from: Point, to: Point): number {
    return Math.hypot(to.x - from.x, to.y - from.y)
}

// A standing pawn's feet fall this far below its centre, so the runner lies under them.
const RunnerFeet = 15
const RunnerHalfWidth = 20
const CornerClearance = 6
const FringeThreads = 9
const FringeSpacing = 4
const FringeLength = 6

export type Segment = { from: Point; to: Point }
export type RunnerLabel = { at: Point; anchor: 'start' | 'end'; rotate: number }
export type QueueRunner = {
    path: string
    labels: [RunnerLabel, RunnerLabel]
    frontFringe: Segment[]
    backFringe: Segment[]
}
export type QueueLayout = { visitors: Point[]; runner: QueueRunner }

const SegmentStarts = QueueSegments.reduce<number[]>(
    (starts, segment, index) => [...starts, starts[index] + segment.length],
    [0]
)
const Corners = SegmentStarts.slice(1, -1)

function segmentAtDistance(along: number): number {
    const index = SegmentStarts.findIndex((start, i) => i > 0 && along < start)
    return index === -1 ? QueueSegments.length : Math.max(1, index)
}

function directionOf(segment: number): Point {
    const from = QueuePath[segment - 1]
    const to = QueuePath[segment]
    const length = distance(from, to)
    return { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
}

function pointAtDistance(along: number): Point {
    const segment = segmentAtDistance(along)
    const direction = directionOf(segment)
    const from = QueuePath[segment - 1]
    const offset = along - SegmentStarts[segment - 1]
    return { x: from.x + direction.x * offset, y: from.y + direction.y * offset }
}

function slotSpacing(segment: number): number {
    return QueueSegments[segment - 1].extent + QueueGap
}

function distanceAtSlot(slot: number): number {
    let remaining = slot
    let segment = 1
    while (segment < QueueSegments.length && remaining > slotsIn(segment)) {
        remaining -= slotsIn(segment)
        segment++
    }
    return SegmentStarts[segment - 1] + remaining * slotSpacing(segment)
}

function isVertical(segment: number): boolean {
    return directionOf(segment).x === 0
}

// Where the runner lies under a point of the queue: below the feet along a row, under the
// pawns' middles down the side, where they stand one above another.
function underfoot(along: number): Point {
    const point = pointAtDistance(along)
    if (!isVertical(segmentAtDistance(along))) return { x: point.x, y: point.y + RunnerFeet }
    const top = QueuePath[1].y + RunnerFeet
    const bottom = QueuePath[2].y + RunnerFeet
    return { x: point.x, y: Math.min(Math.max(point.y, top), bottom) }
}

// Text reads left to right along a row whichever way the queue runs there, and upwards along the
// left side, its letters standing on the board's edge, so a label is anchored at its end nearer
// the visitors. The front label runs back along the path, away from the queue; the back label
// runs on along it.
function runnerLabel(along: number, onward: boolean): RunnerLabel {
    const segment = segmentAtDistance(along)
    if (isVertical(segment)) {
        return { at: underfoot(along), anchor: onward ? 'end' : 'start', rotate: -90 }
    }
    const leftward = directionOf(segment).x < 0
    return { at: underfoot(along), anchor: leftward === onward ? 'end' : 'start', rotate: 0 }
}

// How far past a corner a label must start to clear the runner coming into it: down the side,
// the top row's runner lies below the visitors' feet; along the bottom, the side's runner is
// centred on the lane.
function cornerGap(corner: number): number {
    const onward = segmentAtDistance(corner + 1)
    return (isVertical(onward) ? RunnerFeet : 0) + RunnerHalfWidth + CornerClearance
}

// A label never bends round a corner, so one that would is moved past it, and one just past a
// corner starts clear of the runner coming into it.
function clearOfCorners(start: number, length: number): number {
    const straddled = Corners.find((at) => start < at && start + length > at)
    const from = straddled === undefined ? start : straddled
    const previous = Corners.filter((at) => at <= from).at(-1)
    return previous === undefined ? from : Math.max(from, previous + cornerGap(previous))
}

function fringeAt(along: number, outward: number): Segment[] {
    const direction = directionOf(segmentAtDistance(along))
    const across = { x: -direction.y, y: direction.x }
    const centre = underfoot(along)
    const first = -((FringeThreads - 1) * FringeSpacing) / 2
    return Array.from({ length: FringeThreads }, (_, index) => {
        const offset = first + index * FringeSpacing
        const from = { x: centre.x + across.x * offset, y: centre.y + across.y * offset }
        return {
            from,
            to: {
                x: from.x + direction.x * outward * FringeLength,
                y: from.y + direction.y * outward * FringeLength
            }
        }
    })
}

// Where the runner starts and ends along the queue, and where its last visitor's feet end.
export type RunnerReach = {
    start: number
    end: number
    frontLabel: number
    backLabel: number
    tail: number
}

export function runnerReach(count: number, backLabel: string): RunnerReach {
    const firstSegment = segmentAtDistance(0)
    const frontLabelStart = -(QueueSegments[firstSegment - 1].extent / 2 + LabelGap)
    const lastVisitor = distanceAtSlot(Math.max(0, count - 1))
    const tail = lastVisitor + QueueSegments[segmentAtDistance(lastVisitor) - 1].extent / 2
    const backLabelStart = clearOfCorners(tail + LabelGap, labelLength(backLabel))
    return {
        start: frontLabelStart - FrontLabelRoom - RunnerEndPadding,
        end: backLabelStart + labelLength(backLabel) + RunnerEndPadding,
        frontLabel: frontLabelStart,
        backLabel: backLabelStart,
        tail
    }
}

function runnerPoints(start: number, end: number): Point[] {
    return [
        underfoot(start),
        ...Corners.filter((at) => at > start && at < end).map(underfoot),
        underfoot(end)
    ]
}

// How far along the runner's drawn line a point of the queue lies: down the side the runner runs
// under the visitors' middles rather than their feet, so this differs from the queue distance.
export function runnerLength(start: number, along: number): number {
    const points = runnerPoints(start, along)
    return points
        .slice(1)
        .reduce((total, point, index) => total + distance(points[index], point), 0)
}

// The way the queue runs at a point along it.
export function runnerDirectionAt(along: number): Point {
    return directionOf(segmentAtDistance(along))
}

// How far either side of a corner something travelling the runner takes to turn it.
const RunnerTurn = 22

export type RunnerPose = { at: Point; angle: number }

// A route along the runner that eases through corners: travelling it at an even pace, something
// spends this many times longer on each corner's turn than on the same distance of straight.
const CornerSlowdown = 3
const PaceStep = 1

export type RunnerPace = { length: number; alongAt: (progress: number) => number }

export function runnerPace(from: number, to: number): RunnerPace {
    const sign = to >= from ? 1 : -1
    const steps = Math.max(1, Math.ceil(Math.abs(to - from) / PaceStep))
    const weight = (along: number) =>
        Corners.some((at) => Math.abs(along - at) < RunnerTurn) ? CornerSlowdown : 1
    const cumulative = [0]
    for (let step = 0; step < steps; step++) {
        const along = from + sign * (step + 0.5) * (Math.abs(to - from) / steps)
        cumulative.push(cumulative[step] + weight(along))
    }
    const total = cumulative[steps]
    return {
        length: (total * Math.abs(to - from)) / steps,
        alongAt(progress) {
            const target = progress * total
            const step = Math.min(
                steps - 1,
                Math.max(0, cumulative.findIndex((value) => value >= target) - 1)
            )
            const within = (target - cumulative[step]) / (cumulative[step + 1] - cumulative[step])
            return from + sign * ((step + within) / steps) * Math.abs(to - from)
        }
    }
}

function angleOf(direction: Point): number {
    return (Math.atan2(direction.y, direction.x) * 180) / Math.PI
}

// Where something travelling the runner sits and which way it faces. Near a corner it follows a
// curve from one leg to the other, turning as it goes, instead of snapping through the right angle.
export function runnerPoseAt(along: number): RunnerPose {
    const corner = Corners.find((at) => Math.abs(along - at) < RunnerTurn)
    if (corner === undefined) {
        return { at: underfoot(along), angle: angleOf(runnerDirectionAt(along)) }
    }
    const enter = underfoot(corner - RunnerTurn)
    const bend = underfoot(corner)
    const leave = underfoot(corner + RunnerTurn)
    const t = (along - (corner - RunnerTurn)) / (2 * RunnerTurn)
    const blend = (a: number, b: number, c: number) =>
        (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c
    const tangent = {
        x: 2 * (1 - t) * (bend.x - enter.x) + 2 * t * (leave.x - bend.x),
        y: 2 * (1 - t) * (bend.y - enter.y) + 2 * t * (leave.y - bend.y)
    }
    return {
        at: { x: blend(enter.x, bend.x, leave.x), y: blend(enter.y, bend.y, leave.y) },
        angle: angleOf(tangent)
    }
}

// The queue keeps its front at the top: visitors fill the path from there, and as the queue
// shortens its back end recedes along the path, round the corner and down the side. The runner
// the visitors stand on runs from just past the front label to just past the back label.
export function queueLayout(count: number, backLabel: string): QueueLayout {
    const visitors = Array.from({ length: count }, (_, index) => pointAtQueueSlot(index))
    const reach = runnerReach(count, backLabel)
    const points = runnerPoints(reach.start, reach.end)
    return {
        visitors,
        runner: {
            path: `M ${points.map((point) => `${point.x} ${point.y}`).join(' L ')}`,
            labels: [runnerLabel(reach.frontLabel, false), runnerLabel(reach.backLabel, true)],
            frontFringe: fringeAt(reach.start, -1),
            backFringe: fringeAt(reach.end, 1)
        }
    }
}

export function queueRunnerLabels(count: number): [string, string] {
    return [`Front – ${count} waiting`, 'Back']
}
