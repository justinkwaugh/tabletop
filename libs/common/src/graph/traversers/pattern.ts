import type { CoordinatedGraph, CoordinatedNode } from '../coordinatedGraph.js'
import type { Coordinates } from '../coordinates.js'
import type { Traverser } from '../traverser.js'
import type { CoordinatePattern } from '../pattern.js'

export function patternTraverser<T extends CoordinatedNode<U>, U extends Coordinates>(
    patternOrPatterns: CoordinatePattern<U> | CoordinatePattern<U>[]
): Traverser<CoordinatedGraph<T, U>, T> {
    const patterns = Array.isArray(patternOrPatterns) ? patternOrPatterns : [patternOrPatterns]

    return function* traverse(graph) {
        for (const pattern of patterns) {
            for (const coords of pattern()) {
                const node = graph.nodeAt(coords)
                if (node) {
                    yield node
                }
            }
        }
    }
}
