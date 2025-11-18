import { CoordinatedGraph, CoordinatedNode } from '../coordinatedGraph.js'
import { Coordinates } from '../coordinates.js'
import { Traverser } from '../graph.js'
import { CoordinatePattern } from '../patterns/pattern.js'

export function patternTraverser<T extends CoordinatedNode<U>, U extends Coordinates>(
    pattern: CoordinatePattern<U>
): Traverser<CoordinatedGraph<T, U>, T> {
    return function traverser(graph) {
        const nodes: T[] = []
        for (const coords of pattern()) {
            const node = graph.nodeAt(coords)
            if (node) {
                nodes.push(node)
            }
        }
        return nodes
    }
}
