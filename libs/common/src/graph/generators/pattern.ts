import type { CoordinatedNode, CoordinatedNodeFactory } from '../coordinatedGraph.js'
import type { Coordinates } from '../coordinates.js'
import type { NodeGenerator } from '../generator.js'
import type { CoordinatePattern } from '../pattern.js'

export function patternGenerator<T extends CoordinatedNode<U>, U extends Coordinates>(
    patternOrPatterns: CoordinatePattern<U> | CoordinatePattern<U>[],
    factory: CoordinatedNodeFactory<U, T>
): NodeGenerator<T> {
    const patterns = Array.isArray(patternOrPatterns) ? patternOrPatterns : [patternOrPatterns]

    return function* generator() {
        for (const pattern of patterns) {
            for (const coords of pattern()) {
                yield factory(coords)
            }
        }
    }
}
