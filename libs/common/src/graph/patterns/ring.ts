import { AxialCoordinates } from '../coordinates.js'
import {
    ClockwisePointyHexDirections,
    FlatHexDirection,
    isFlatHexDirection,
    isPointyHexDirection,
    PointyHexDirection,
    RotationDirection
} from '../directions.js'
import {
    addAxial,
    FlatNeighborOffsets,
    HexOrientation,
    PointyNeighborOffsets,
    scaleAxial
} from '../grids/hex.js'
import { CoordinatePattern } from '../pattern.js'

export type HexRingPatternOptions = {
    center?: AxialCoordinates
    radius: number
    orientation: HexOrientation
    initialDirection?: PointyHexDirection | FlatHexDirection
    rotationDirection?: RotationDirection
}

export function hexRingPattern(
    options: HexRingPatternOptions
): CoordinatePattern<AxialCoordinates> {
    const center: AxialCoordinates = options.center ?? { q: 0, r: 0 }
    const initialDirection =
        options.initialDirection ??
        (options.orientation === HexOrientation.PointyTop
            ? PointyHexDirection.Northeast
            : FlatHexDirection.Northeast)
    const rotationDirection = options.rotationDirection ?? RotationDirection.Clockwise

    return function* pattern() {
        if (options.radius === 0) {
            yield { ...center }
            return
        }

        let currentHex = calculateStartHex(
            center,
            options.radius,
            options.orientation,
            initialDirection
        )

        for (const offset of options.orientation === HexOrientation.PointyTop
            ? pointyDirectionOffsetIterator(
                  initialDirection as PointyHexDirection,
                  rotationDirection
              )
            : flatDirectionOffsetIterator(
                  initialDirection as FlatHexDirection,
                  rotationDirection
              )) {
            for (let i = 0; i < options.radius; i++) {
                yield currentHex
                currentHex = addAxial(currentHex, offset)
            }
        }
    }
}

function calculateStartHex(
    start: AxialCoordinates,
    radius: number,
    orientation: HexOrientation,
    initialDirection: PointyHexDirection | FlatHexDirection
): AxialCoordinates {
    let initialOffset
    if (orientation === HexOrientation.PointyTop && isPointyHexDirection(initialDirection)) {
        initialOffset = PointyNeighborOffsets[initialDirection]
    } else if (orientation === HexOrientation.FlatTop && isFlatHexDirection(initialDirection)) {
        initialOffset = FlatNeighborOffsets[initialDirection]
    } else {
        throw new Error(
            `Invalid initial direction ${initialDirection} for hex grid with orientation ${orientation}`
        )
    }
    return addAxial(start, scaleAxial(initialOffset, radius))
}

function* pointyDirectionOffsetIterator(
    initialDirection: PointyHexDirection,
    rotationDirection: RotationDirection
): Iterable<AxialCoordinates> {
    let directions =
        rotationDirection === RotationDirection.Clockwise
            ? ClockwisePointyHexDirections
            : ClockwisePointyHexDirections.toReversed()

    let index = directions.indexOf(initialDirection)
    index = (index + 2) % directions.length // Turn 2 steps to get to the first side direction
    for (let i = 0; i < 6; i++) {
        yield PointyNeighborOffsets[directions[index]]
        index = (index + 1) % directions.length
    }
}
function* flatDirectionOffsetIterator(
    initialDirection: FlatHexDirection,
    rotationDirection: RotationDirection
): Iterable<AxialCoordinates> {
    let directions =
        rotationDirection === RotationDirection.Clockwise
            ? Object.values(FlatHexDirection)
            : Object.values(FlatHexDirection).toReversed()

    let index = directions.indexOf(initialDirection)
    index = (index + 2) % directions.length // Turn 2 steps to get to the first side direction
    for (let i = 0; i < 6; i++) {
        yield FlatNeighborOffsets[directions[index]]
        index = (index + 1) % directions.length
    }
}
