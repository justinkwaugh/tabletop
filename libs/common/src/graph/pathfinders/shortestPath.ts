import { type Graph, type Node, type NodeIdentifier, type Pathfinder } from '../graph.js'

export interface ShortestPathOptions<T extends Node> {
    start: T
    end: T
    range?: number
    canTraverse?: (from: T, to: T) => boolean
}

export function shortestPath<T extends Node>(options: ShortestPathOptions<T>): Pathfinder<T> {
    return function breadthFirstSearch(graph: Graph<T>): T[][] {
        const visitedNodes = new Map<NodeIdentifier, T>()
        let depth = 0

        const startNode = options.start
        const endNode = options.end
        const parents: Map<NodeIdentifier, T> = new Map()
        const queue: T[] = [startNode]
        visitedNodes.set(startNode.id, startNode)

        search: while (queue.length > 0 && (options.range === undefined || depth < options.range)) {
            const numAtCurrentDepth = queue.length
            for (let i = 0; i < numAtCurrentDepth; i++) {
                const currentNode = queue.shift()!
                for (const neighbor of graph.neighborsOf(currentNode)) {
                    if (options.canTraverse && !options.canTraverse(currentNode, neighbor)) {
                        continue
                    }
                    const neighborId = neighbor.id
                    if (!visitedNodes.has(neighborId)) {
                        visitedNodes.set(neighborId, neighbor)
                        parents.set(neighborId, currentNode)

                        if (neighbor.id === endNode.id) {
                            break search
                        }
                        queue.push(neighbor)
                    }
                }
            }
            depth++
        }

        const path = []

        let target = visitedNodes.get(endNode.id)
        while (target) {
            path.unshift(target)
            target = parents.get(target.id)
        }

        return path.length > 0 ? [path] : []
    }
}
