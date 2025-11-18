import { CoordinatedNode, CoordinatedNodeFactory } from './coordinatedGraph.js'
import { Coordinates } from './coordinates.js'
import { CoordinatePattern } from './pattern.js'
import { Node } from './graph.js'

export type NodeGenerator<T extends Node> = () => Iterable<T>

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
