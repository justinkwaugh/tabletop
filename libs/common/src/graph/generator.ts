import { CoordinatedNode, CoordinatedNodeFactory } from './coordinatedGraph.js'
import { Coordinates, coordinatesToNumber } from './coordinates.js'
import { CoordinatePattern } from './pattern.js'
import { GraphNode } from './graph.js'

export type NodeGenerator<T extends GraphNode> = () => Iterable<T>

export function defaultCoordinateNodeFactory<T extends Coordinates>(coords: T): CoordinatedNode<T> {
    return { id: coordinatesToNumber(coords), coords }
}

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
