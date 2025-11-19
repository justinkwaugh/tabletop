import {
    OffsetCoordinates,
    type Graph,
    type GraphNode,
    type NodeIdentifier,
    type Pathfinder
} from '@tabletop/common'
import { HydratedSolGameBoard } from '../components/gameBoard.js'
import { solTraverseChecker } from './solTraverser.js'
import { SolarGate } from '../components/solarGate.js'

export function solPathfinder({
    board,
    start,
    end,
    allowedGates,
    range
}: {
    board: HydratedSolGameBoard
    start: OffsetCoordinates
    end: OffsetCoordinates
    allowedGates?: SolarGate[] //This allows us to only allow movement through certain gates
    range?: number
}) {
    const startNode = board.graph.nodeAt(start)
    if (!startNode) {
        return () => []
    }

    const endNode = board.graph.nodeAt(end)
    if (!endNode) {
        return () => []
    }

    return shortestPath({
        start: startNode,
        end: endNode,
        range,
        canTraverse: solTraverseChecker(board, allowedGates)
    })
}

export function shortestPath<T extends GraphNode>(options: ShortestPathOptions<T>): Pathfinder<T> {
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

export interface ShortestPathOptions<T extends GraphNode> {
    start: T
    end: T
    range?: number
    canTraverse?: (from: T, to: T) => boolean
}
