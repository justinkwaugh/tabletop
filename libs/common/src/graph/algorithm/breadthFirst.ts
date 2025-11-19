import { GraphNode, Graph, NodeIdentifier } from '../graph.js'

export interface BreadthFirstAlgorithmOptions<T extends GraphNode> {
    start: T
    range?: number
    canTraverse?: (from: T, to: T) => boolean
}

export type BreadthFirstAlgorithmResult<T extends GraphNode> = {
    depth: number
    prior?: T
    node: T
}

export function* breadthFirstAlgorithm<T extends GraphNode, G extends Graph<T>>(
    options: BreadthFirstAlgorithmOptions<T>,
    graph: G
): Iterable<BreadthFirstAlgorithmResult<T>> {
    const visitedNodes = new Map<NodeIdentifier, T>()
    const startNode = options.start
    let depth = 0

    const queue: T[] = [startNode]
    visitedNodes.set(startNode.id, startNode)
    yield {
        depth,
        node: startNode
    }

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
                    yield {
                        depth,
                        prior: currentNode,
                        node: neighbor
                    }
                }
            }
        }
        depth++
    }
}
