import { CoordinatedNode } from './coordinatedGraph.js'
import { Coordinates } from './coordinates.js'
import { NodeGenerator } from './graph.js'
import { CoordinatePattern } from './patterns/pattern.js'

export type CoordinatedNodeFactory<
    U extends Coordinates,
    T extends CoordinatedNode<U> = CoordinatedNode<U>
> = (coords: U) => T

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
