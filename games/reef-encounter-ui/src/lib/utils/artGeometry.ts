import type { BoundingBox, OffsetCoordinates, Point, RectangleDimensions } from '@tabletop/common'
import { AlgaColor, CoralColor } from '@tabletop/reef-encounter'

// The art is cut at twice the size the table draws it, so it stays sharp on high-density
// screens; every position here is in image pixels.
export const ImageToTable = 0.5

export const BoardImage: RectangleDimensions = { width: 1143, height: 1397 }
export const OpenSeaImage: RectangleDimensions = { width: 1575, height: 1143 }

const BoardGridOrigin: Point = { x: 138.9, y: 159.1 }
const BoardSquare: RectangleDimensions = { width: 144, height: 143.4 }

export function boardSquare(coords: OffsetCoordinates): BoundingBox {
    return {
        x: BoardGridOrigin.x + coords.col * BoardSquare.width,
        y: BoardGridOrigin.y + coords.row * BoardSquare.height,
        ...BoardSquare
    }
}

const CoralTileSlotSize = 198
const CoralTileSlotColumns = [186, 437, 683, 931, 1176]
const CoralTileSlotRows = [98, 321]

export function coralTileSlot(index: number): BoundingBox {
    const columns = CoralTileSlotColumns.length
    return {
        x: CoralTileSlotColumns[index % columns],
        y: CoralTileSlotRows[Math.floor(index / columns)],
        width: CoralTileSlotSize,
        height: CoralTileSlotSize
    }
}

const LarvaSpaceSize: RectangleDimensions = { width: 346, height: 224 }
const LarvaSpaceOrigins: Record<CoralColor, Point> = {
    [CoralColor.White]: { x: 109, y: 569 },
    [CoralColor.Yellow]: { x: 503, y: 569 },
    [CoralColor.Orange]: { x: 899, y: 569 },
    [CoralColor.Grey]: { x: 218, y: 819 },
    [CoralColor.Pink]: { x: 612, y: 819 }
}

export function larvaSpace(color: CoralColor): BoundingBox {
    return { ...LarvaSpaceOrigins[color], ...LarvaSpaceSize }
}

// Polyps in a larva space are as large as on the reef boards, so more than two overlap, fanned
// out to the space's right edge clear of its colour square and larva cube.
const LarvaPolypSpan = { left: 54, right: 338 }

export function larvaSpacePolyp(color: CoralColor, index: number, count: number): BoundingBox {
    const area = larvaSpace(color)
    const size = BoardSquare.width
    const room = LarvaPolypSpan.right - LarvaPolypSpan.left - size
    const step = count > 1 ? Math.min(size + 6, room / (count - 1)) : 0
    return {
        x: area.x + LarvaPolypSpan.left + index * step,
        y: area.y + (area.height - size) / 2,
        width: size,
        height: size
    }
}

export function larvaSpaceCube(color: CoralColor): Point {
    const area = larvaSpace(color)
    return { x: area.x + 30, y: area.y + area.height - 44 }
}

export const AlgaSpace: Point = { x: 1377, y: 682 }

const EatenShrimpSlotColumns = [1137, 1213, 1288, 1358, 1425]
const EatenShrimpSlotCentreY = 930

// A shrimp piece is as long as the silhouettes printed on the open sea, a little longer than a
// reef square.
export const ShrimpLength = 150

export function eatenShrimpSlot(index: number): Point {
    return { x: EatenShrimpSlotColumns[index], y: EatenShrimpSlotCentreY }
}

// Sampled from the open-sea board's colour squares and the algae printed on the coral tiles.
export const CoralPaint: Record<CoralColor, string> = {
    [CoralColor.White]: '#fffffd',
    [CoralColor.Yellow]: '#f4e92d',
    [CoralColor.Orange]: '#ef8f2e',
    [CoralColor.Grey]: '#8f867f',
    [CoralColor.Pink]: '#e86ca0'
}

export const AlgaPaint: Record<AlgaColor, string> = {
    [AlgaColor.Blue]: '#7fb4e2',
    [AlgaColor.Green]: '#5fae3e',
    [AlgaColor.Purple]: '#93519f',
    [AlgaColor.Red]: '#e2462c'
}

export type BoardRotation = 0 | 90 | 180 | 270

// The table shows each board's grid with a narrow band of the surrounding water, enough for the
// rock's edges and shadow, and the open sea without its outer margin.
const BoardMargin = 48
export const BoardView: BoundingBox = {
    x: BoardGridOrigin.x - BoardMargin,
    y: BoardGridOrigin.y - BoardMargin,
    width: 6 * BoardSquare.width + 2 * BoardMargin,
    height: 7 * BoardSquare.height + 2 * BoardMargin
}
export const OpenSeaView: BoundingBox = { x: 40, y: 50, width: 1495, height: 1040 }

// Turns a view so its bottom edge faces the given side of the table.
export function rotatedView(
    view: BoundingBox,
    rotation: BoardRotation
): { size: RectangleDimensions; transform: string } {
    const { width, height } = view
    const toView = `translate(${-view.x} ${-view.y})`
    switch (rotation) {
        case 0:
            return { size: { width, height }, transform: toView }
        case 90:
            return {
                size: { width: height, height: width },
                transform: `translate(${height} 0) rotate(90) ${toView}`
            }
        case 180:
            return {
                size: { width, height },
                transform: `translate(${width} ${height}) rotate(180) ${toView}`
            }
        case 270:
            return {
                size: { width: height, height: width },
                transform: `translate(0 ${width}) rotate(270) ${toView}`
            }
    }
}

// Keeps a piece upright on a turned board.
export function upright(rotation: BoardRotation, center: Point): string {
    return `rotate(${-rotation} ${center.x} ${center.y})`
}
