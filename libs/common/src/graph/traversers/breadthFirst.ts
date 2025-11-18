import { breadthFirstAlgorithm } from '../algorithm/breadthFirst.js'
import { Graph, type Node } from '../graph.js'
import { Traverser } from '../traverser.js'

export interface BreadthFirstOptions<T extends Node> {
    start: T
    range?: number
    canTraverse?: (from: T, to: T) => boolean
}

export function breadthFirst<T extends Node>(
    options: BreadthFirstOptions<T>
): Traverser<Graph<T>, T> {
    return function* traverse(graph) {
        for (const node of breadthFirstAlgorithm(options, graph)) {
            yield node.node
        }
    }
}
