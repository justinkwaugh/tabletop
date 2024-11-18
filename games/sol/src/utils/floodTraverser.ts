import { Coordinates, coordinatesToNumber } from '@tabletop/common'
import { Node, Traverser } from './graph'

export function flood<T extends Node<U>, U extends Coordinates>(
    options: FloodOptions<T, U>
): Traverser<T, U> {
    return function floodTraverser(graph) {
        const visitedNodes = new Map<number, T>()
        const startNode = options.start
        let depth = 0
        const queue: T[] = [startNode]
        visitedNodes.set(coordinatesToNumber(startNode.coords), startNode)

        while (queue.length > 0 && (options.range === undefined || depth < options.range)) {
            const numAtCurrentDepth = queue.length
            for (let i = 0; i < numAtCurrentDepth; i++) {
                const currentNode = queue.shift()!
                for (const neighbor of graph.neighborsOf(currentNode.coords)) {
                    if (options.canTraverse && !options.canTraverse(startNode, neighbor)) {
                        continue
                    }
                    const neighborKey = coordinatesToNumber(neighbor.coords)
                    if (!visitedNodes.has(neighborKey)) {
                        visitedNodes.set(neighborKey, neighbor)
                        queue.push(neighbor)
                    }
                }
            }
            depth++
        }
        return [...visitedNodes.values()]
    }
}

export interface FloodOptions<T extends Node<U>, U extends Coordinates> {
    start: T
    range?: number
    canTraverse?: (from: T, to: T) => boolean
}
