import type { OffsetCoordinates, Point } from '@tabletop/common'
import {
    BoardColumns,
    BoardRows,
    EntranceFountainIds,
    getShop,
    startingQueueLength,
    type ShopId
} from '@tabletop/marracash'

export const CellSize = 80
export const WallThickness = 28
export const BoardWidth = BoardColumns * CellSize + 2 * WallThickness
export const BoardHeight = BoardRows * CellSize + 2 * WallThickness

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

export function clusterPositions(count: number, center: Point, spacing: number): Point[] {
    const columns = Math.ceil(Math.sqrt(count))
    const rows = Math.ceil(count / columns)
    return Array.from({ length: count }, (_, index) => {
        const row = Math.floor(index / columns)
        const inRow = row === rows - 1 ? count - row * columns : columns
        const col = index % columns
        return {
            x: center.x + (col - (inRow - 1) / 2) * spacing,
            y: center.y + (row - (rows - 1) / 2) * spacing
        }
    })
}

const GateWidth = 52

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

const QueuePathLength = QueuePath.slice(1).reduce(
    (length, _, index) => length + segmentLength(index + 1),
    0
)

const QueueSpacing = QueuePathLength / (startingQueueLength(EntranceFountainIds.length) - 1)

export type QueueLayout = { visitors: Point[]; front: Point; back: Point }

export function queueLayout(count: number): QueueLayout {
    const start = (QueuePathLength - (count - 1) * QueueSpacing) / 2
    const end = start + (count - 1) * QueueSpacing
    return {
        visitors: Array.from({ length: count }, (_, index) =>
            pointAlongQueue(start + index * QueueSpacing)
        ),
        front: pointAlongQueue(start - 1.5 * QueueSpacing),
        back: pointAlongQueue(end + 1.5 * QueueSpacing)
    }
}

export const QueueCountLabel: Point = { x: TableWidth - QueueLane, y: TableHeight / 2 }

function pointAlongQueue(offset: number): Point {
    let remaining = offset
    let segment = 1
    while (segment < QueuePath.length - 1 && remaining > segmentLength(segment)) {
        remaining -= segmentLength(segment)
        segment++
    }
    const from = QueuePath[segment - 1]
    const to = QueuePath[segment]
    const t = remaining / segmentLength(segment)
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

function segmentLength(segment: number): number {
    return distance(QueuePath[segment - 1], QueuePath[segment])
}

function distance(from: Point, to: Point): number {
    return Math.hypot(to.x - from.x, to.y - from.y)
}
