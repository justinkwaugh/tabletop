import { breadthFirstAlgorithm } from '../algorithm/breadthFirst.js'
import { type Graph, type GraphNode, type NodeIdentifier } from '../graph.js'
import type { Pathfinder } from '../pathfinder.js'
export interface ShortestPathPathfinderOptions<T extends GraphNode> {
    start: T
    end: T
    range?: number
    canTraverse?: (from: T, to: T) => boolean
}

export function shortestPathPathfinder<T extends GraphNode>(
    options: ShortestPathPathfinderOptions<T>
): Pathfinder<T> {
    return function pathfind(graph: Graph<T>): T[][] {
        const endNode = options.end
        const parents: Map<NodeIdentifier, T> = new Map()

        for (const node of breadthFirstAlgorithm(options, graph)) {
            if (node.prior) {
                parents.set(node.node.id, node.prior)
            }
            if (node.node.id === endNode.id) {
                break
            }
        }

        const path = []

        let target: T | undefined = endNode
        while (target) {
            path.unshift(target)
            target = parents.get(target.id)
        }

        return path.length > 0 ? [path] : []
    }
}
