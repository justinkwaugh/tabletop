import type { OffsetCoordinates, Point } from '@tabletop/common'
import {
    BoardColumns,
    BoardRows,
    EntranceFountainIds,
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

export const CandidateHaloFilterId = 'marracash-candidate-halo'
// Sized in board space: a straight line has an empty bounding box, which
// would give a bounding-box filter no area to draw in.
export const LineHaloFilterId = 'marracash-line-halo'
export const CastShadowFilterId = 'marracash-cast-shadow'

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

export const QueueMargin = 48
export const TableWidth = BoardWidth + 2 * QueueMargin
export const TableHeight = BoardHeight + 2 * QueueMargin

const QueueLane = QueueMargin / 2
const QueueReach = 0.75
const QueueEndX = QueueMargin + QueueReach * BoardWidth

const QueuePath: Point[] = [
    { x: QueueEndX, y: QueueLane },
    { x: QueueLane, y: QueueLane },
    { x: QueueLane, y: TableHeight - QueueLane },
    { x: QueueEndX, y: TableHeight - QueueLane }
]

export const QueuePawnSize = 30

const QueuePawnScale = QueuePawnSize / PawnUnitSize
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
const QueueSlotCount = slotsAlongQueue(QueueGap)

export type QueueLayout = { visitors: Point[]; front: Point; back: Point }

export function queueLayout(count: number): QueueLayout {
    const start = (QueueSlotCount - (count - 1)) / 2
    const end = start + count - 1
    return {
        visitors: Array.from({ length: count }, (_, index) => pointAtQueueSlot(start + index)),
        front: pointAtQueueSlot(start - 1.5),
        back: pointAtQueueSlot(end + 1.5)
    }
}

export const QueueCountLabel: Point = { x: TableWidth - QueueMargin, y: QueueLane }

function pointAtQueueSlot(slot: number): Point {
    let remaining = slot
    let segment = 1
    while (segment < QueuePath.length - 1 && remaining > slotsIn(segment)) {
        remaining -= slotsIn(segment)
        segment++
    }
    const from = QueuePath[segment - 1]
    const to = QueuePath[segment]
    const t = remaining / slotsIn(segment)
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

function slotsIn(segment: number): number {
    const { length, extent } = QueueSegments[segment - 1]
    return length / (extent + QueueGap)
}

export function distance(from: Point, to: Point): number {
    return Math.hypot(to.x - from.x, to.y - from.y)
}
