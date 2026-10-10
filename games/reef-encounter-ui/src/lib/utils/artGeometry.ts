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

export const AlgaSpace: Point = { x: 1377, y: 682 }

const EatenShrimpSlotColumns = [1137, 1213, 1288, 1358, 1425]
const EatenShrimpSlotCentreY = 930

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

// Turns a board's image-pixel drawing so its bottom edge faces the given side of the table.
export function rotatedBoard(rotation: BoardRotation): {
    size: RectangleDimensions
    transform: string
} {
    const { width, height } = BoardImage
    switch (rotation) {
        case 0:
            return { size: { width, height }, transform: '' }
        case 90:
            return {
                size: { width: height, height: width },
                transform: `translate(${height} 0) rotate(90)`
            }
        case 180:
            return {
                size: { width, height },
                transform: `translate(${width} ${height}) rotate(180)`
            }
        case 270:
            return {
                size: { width: height, height: width },
                transform: `translate(0 ${width}) rotate(270)`
            }
    }
}
