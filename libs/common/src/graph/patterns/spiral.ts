import { AxialCoordinates } from '../coordinates.js'
import { RotationDirection } from '../directions.js'
import { HexOrientation } from '../grids/hex.js'
import { CoordinatePattern } from '../pattern.js'
import { hexRingPattern } from './ring.js'

export type HexSpiralPatternOptions = {
    center?: AxialCoordinates
    radius: number
    orientation: HexOrientation
    rotationDirection?: RotationDirection
}

export function hexSpiralPattern(
    options: HexSpiralPatternOptions
): CoordinatePattern<AxialCoordinates> {
    return function* pattern() {
        // We just yield rings from radius 0 to the specified radius
        for (let radius = 0; radius <= options.radius; radius++) {
            const ringPattern = hexRingPattern({
                center: options.center,
                radius,
                orientation: options.orientation,
                rotationDirection: options.rotationDirection
            })

            // To make the spiral look actually like a spiral if visualized, we need to rotate each ring
            // so that it starts where the last ring ended.
            const ring = Array.from(ringPattern())
            // rotate array by one to the left
            if (ring.length > 0 && radius > 1) {
                ring.unshift(ring.pop()!)
            }
            for (const hex of ring) {
                yield hex
            }
        }
    }
}
