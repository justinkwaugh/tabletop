import { OffsetCoordinates } from '../coordinates.js'
import { CoordinatePattern } from './pattern.js'

export type Rectangle = {
    start: OffsetCoordinates
    width: number
    height: number
    solid?: boolean
}

export function rectangle(config: Rectangle): CoordinatePattern<OffsetCoordinates> {
    return function* rectanglePattern() {
        const solid = config.solid ?? true
        if (solid) {
            yield* generateSolidRectangle(config)
        } else {
            yield* generateHollowRectangle(config)
        }
    }
}

function* generateSolidRectangle(rectangle: Rectangle) {
    const current: OffsetCoordinates = { ...rectangle.start }
    const rowEnd = rectangle.start.row + rectangle.height
    const colEnd = rectangle.start.col + rectangle.width
    for (let rowOffset = rectangle.start.row; rowOffset < rowEnd; rowOffset++) {
        for (let colOffset = rectangle.start.col; colOffset < colEnd; colOffset++) {
            yield {
                row: current.row + rowOffset,
                col: current.col + colOffset
            }
        }
    }
}

function* generateHollowRectangle(rectangle: Rectangle) {
    const current: OffsetCoordinates = { ...rectangle.start }
    const rowEnd = rectangle.start.row + rectangle.height
    const colEnd = rectangle.start.col + rectangle.width
    const rowLen = rowEnd - rectangle.start.row
    const colLen = colEnd - rectangle.start.col

    // Generate in order top, right, bottom, left
    for (let colOffset = rectangle.start.col; colOffset < colEnd; colOffset++) {
        // Top edge
        yield {
            row: current.row + rectangle.start.row,
            col: current.col + colOffset
        }
    }

    if (rowLen > 1) {
        for (let rowOffset = rectangle.start.row + 1; rowOffset < rowEnd - 1; rowOffset++) {
            // Right edge
            yield {
                row: current.row + rowOffset,
                col: current.col + colEnd - 1
            }
        }

        for (let colOffset = colEnd - 1; colOffset >= rectangle.start.col; colOffset--) {
            // Bottom edge
            yield {
                row: current.row + rowEnd - 1,
                col: current.col + colOffset
            }
        }

        if (colLen > 1) {
            for (let rowOffset = rowEnd - 2; rowOffset > rectangle.start.row; rowOffset--) {
                // Left edge
                yield {
                    row: current.row + rowOffset,
                    col: current.col + rectangle.start.col
                }
            }
        }
    }
}
