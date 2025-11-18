import { CoordinatedGraph, CoordinatedNode } from '../coordinatedGraph.js'
import { Coordinates } from '../coordinates.js'
import { Traverser } from '../graph.js'
import { CoordinatePattern } from '../patterns/pattern.js'

export function patternTraverser<T extends CoordinatedNode<U>, U extends Coordinates>(
    patternOrPatterns: CoordinatePattern<U> | CoordinatePattern<U>[]
): Traverser<CoordinatedGraph<T, U>, T> {
    const patterns = Array.isArray(patternOrPatterns) ? patternOrPatterns : [patternOrPatterns]

    return function traverser(graph) {
        const nodes: T[] = []
        for (const pattern of patterns) {
            for (const coords of pattern()) {
                const node = graph.nodeAt(coords)
                if (node) {
                    nodes.push(node)
                }
            }
        }
        return nodes
    }
}
