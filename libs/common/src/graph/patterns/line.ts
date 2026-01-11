import type { OffsetCoordinates } from '../coordinates.js'
import type { Direction } from '../directions.js'
import { CardinalDirection, OrdinalDirection } from '../directions.js'

import type { CoordinatePattern } from '../pattern.js'

export type LineSegment = {
    start: OffsetCoordinates
    end: OffsetCoordinates
}

function isLineSegment(config: LineSegment | LineVector): config is LineSegment {
    return (config as LineSegment).end !== undefined
}

export type LineVector = {
    start: OffsetCoordinates
    direction: Direction
    length: number
}

export function linePattern(
    config: LineSegment | LineVector
): CoordinatePattern<OffsetCoordinates> {
    return function* pattern() {
        const current: OffsetCoordinates = { ...config.start }
        if (!isLineSegment(config)) {
            for (let i = 0; i < config.length; i++) {
                yield { ...current }
                switch (config.direction) {
                    case CardinalDirection.North:
                        current.row -= 1
                        break
                    case CardinalDirection.East:
                        current.col += 1
                        break
                    case CardinalDirection.South:
                        current.row += 1
                        break
                    case CardinalDirection.West:
                        current.col -= 1
                        break
                    case OrdinalDirection.Northeast:
                        current.row -= 1
                        current.col += 1
                        break
                    case OrdinalDirection.Southeast:
                        current.row += 1
                        current.col += 1
                        break
                    case OrdinalDirection.Southwest:
                        current.row += 1
                        current.col -= 1
                        break
                    case OrdinalDirection.Northwest:
                        current.row -= 1
                        current.col -= 1
                        break
                }
            }
        }
    }
}
