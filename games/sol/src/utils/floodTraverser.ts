import { type Node, type NodeIdentifier, type Traverser } from './graph.js'

export function flood<T extends Node>(options: FloodOptions<T>): Traverser<T> {
    return function floodTraverser(graph) {
        const visitedNodes = new Map<NodeIdentifier, T>()
        const startNode = options.start
        let depth = 0

        const queue: T[] = [startNode]
        visitedNodes.set(startNode.id, startNode)

        while (queue.length > 0 && (options.range === undefined || depth < options.range)) {
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
                        queue.push(neighbor)
                    }
                }
            }
            depth++
        }
        return [...visitedNodes.values()]
    }
}

export interface FloodOptions<T extends Node> {
    start: T
    range?: number
    canTraverse?: (from: T, to: T) => boolean
}
