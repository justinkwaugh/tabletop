import { OffsetCoordinates } from '@tabletop/common'
import { HydratedSolGameBoard } from '../components/gameBoard.js'
import { flood } from './floodTraverser.js'
import { Ring, SolNode } from './solGraph.js'

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

    return flood({
        start: startNode,
        range,
        canTraverse: solTraverseChecker(board)
    })
}

export function solTraverseChecker(board: HydratedSolGameBoard) {
    return (from: SolNode, to: SolNode) => {
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

        // Traversing between other rings is allowed if there is a gate between them
        return board.hasGateBetween(from.coords, to.coords)
    }
}
