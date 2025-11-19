import { breadthFirstAlgorithm } from '../algorithm/breadthFirst.js'
import { Graph, type GraphNode } from '../graph.js'
import { Traverser } from '../traverser.js'

export interface BreadthFirstTraverserOptions<T extends GraphNode> {
    start: T
    range?: number
    canTraverse?: (from: T, to: T) => boolean
}

export function breadthFirstTraverser<T extends GraphNode>(
    options: BreadthFirstTraverserOptions<T>
): Traverser<Graph<T>, T> {
    return function* traverse(graph) {
        for (const node of breadthFirstAlgorithm(options, graph)) {
            yield node.node
        }
    }
}
