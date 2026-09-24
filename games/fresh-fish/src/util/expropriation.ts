import {
    assertExists,
    areOrthogonal,
    offsetToOffsetTuple,
    offsetTupleToOffset,
    sameCoordinates,
    type OffsetTupleCoordinates
} from '@tabletop/common'
import { canBeBlocked, isDiskCell, isTraversable, mustBeReachable } from '../components/cells.js'
import type { HydratedGameBoard } from '../components/gameBoard.js'
import { FreshFishGraph } from './freshFishGraph.js'

export type ReturnedDisks = Record<string, number>

export class Expropriator {
    graph: FreshFishGraph

    constructor(private readonly board: HydratedGameBoard) {
        this.graph = board.graph
    }

    calculateExpropriation(placement?: OffsetTupleCoordinates): {
        expropriatedCoords: OffsetTupleCoordinates[]
        returnedDisks: ReturnedDisks
    } {
        const nodes = Array.from(this.graph)
        const cells = nodes.map((node) => {
            const cell = this.board.cellAt(node.coords)
            assertExists(cell, 'Expropriation graph node must have a board cell')
            return cell
        })
        const indices = new Map(nodes.map((node, index) => [node.id, index]))
        const traversable = cells.map(isTraversable)
        const expectedCount = cells.filter(mustBeReachable).length
        const placementIndex = nodes.findIndex(
            (node) =>
                placement !== undefined &&
                sameCoordinates(node.coords, offsetTupleToOffset(placement))
        )
        const neighbors = nodes.map((node, index) => {
            if (!traversable[index]) return []
            return this.graph.neighborsOf(node).flatMap((neighbor) => {
                const neighborIndex = indices.get(neighbor.id)
                assertExists(neighborIndex, 'Expropriation neighbor must be in the graph')
                return areOrthogonal(node.coords, neighbor.coords) &&
                    mustBeReachable(cells[neighborIndex])
                    ? [neighborIndex]
                    : []
            })
        })
        const expropriatedCoords: OffsetTupleCoordinates[] = []
        const returnedDisks: ReturnedDisks = {}
        for (const [blocked, cell] of cells.entries()) {
            if (!canBeBlocked(cell)) continue
            const start = traversable.findIndex(
                (canTraverse, index) => canTraverse && index !== blocked && index !== placementIndex
            )
            if (this.countReachable(neighbors, start, blocked, placementIndex) === expectedCount) {
                continue
            }
            expropriatedCoords.push(offsetToOffsetTuple(nodes[blocked].coords))
            if (isDiskCell(cell)) {
                returnedDisks[cell.playerId] = (returnedDisks[cell.playerId] ?? 0) + 1
            }
        }
        return { expropriatedCoords, returnedDisks }
    }

    private countReachable(
        neighbors: readonly (readonly number[])[],
        start: number,
        blocked: number,
        placement: number
    ): number {
        if (start === -1) return 0
        const visited = new Uint8Array(neighbors.length)
        const queue = [start]
        visited[start] = 1
        for (let index = 0; index < queue.length; index++) {
            const current = queue[index]
            if (current === blocked || current === placement) continue
            for (const neighbor of neighbors[current]) {
                if (visited[neighbor]) continue
                visited[neighbor] = 1
                queue.push(neighbor)
            }
        }
        return queue.length
    }
}
