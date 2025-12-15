import { OffsetCoordinates, breadthFirstTraverser, coordinatesToNumber } from '@tabletop/common'
import { HydratedSolGameBoard } from '../components/gameBoard.js'
import { Ring, type SolNode } from './solGraph.js'
import { SolarGate } from '../components/solarGate.js'

export function solTraverser({
    board,
    start,
    range
}: {
    board: HydratedSolGameBoard
    start: OffsetCoordinates
    range?: number
}) {
    const startNode = board.graph.nodeAt(start)
    if (!startNode) {
        return () => []
    }

    return breadthFirstTraverser({
        start: startNode,
        range,
        canTraverse: solTraverseChecker(board)
    })
}

export function solTraverseChecker(
    board: HydratedSolGameBoard,
    allowedGates?: SolarGate[],
    illegalCoordinates?: OffsetCoordinates[],
    transcend: boolean = false
) {
    const illegalKeys = new Set(illegalCoordinates?.map((coords) => coordinatesToNumber(coords)))

    return (from: SolNode, to: SolNode) => {
        // Can't go there
        if (illegalKeys.has(coordinatesToNumber(to.coords))) {
            return false
        }

        // Traversing within a ring is always allowed
        if (from.coords.row === to.coords.row) {
            return true
        }

        // Traversing between inner and outer rings is always allowed
        if (
            (from.coords.row === Ring.Outer && to.coords.row === Ring.Inner) ||
            (from.coords.row === Ring.Inner && to.coords.row === Ring.Outer)
        ) {
            return true
        }

        // Traversing to the center is always allowed
        if (to.coords.row === Ring.Center && from.coords.row === Ring.Core) {
            return true
        }

        // Traversing between other rings is allowed if there is a gate between them
        // or if transcend is active
        if (transcend) {
            return true
        }

        if (allowedGates) {
            return allowedGates.some((gate) => {
                return board.isGateBetween(gate, from.coords, to.coords)
            })
        } else {
            return board.hasGateBetween(from.coords, to.coords)
        }
    }
}
