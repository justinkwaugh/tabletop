import {
    breadthFirstTraverser,
    OffsetCoordinates,
    OffsetTupleCoordinates,
    RectilinearGridNode,
    sameCoordinates,
    offsetTupleToOffset,
    offsetToOffsetTuple,
    areOrthogonal
} from '@tabletop/common'
import { canBeBlocked, Cell, isDiskCell, isTraversable } from '../components/cells.js'
import { HydratedGameBoard } from '../components/gameBoard.js'
import { FreshFishGraph } from './freshFishGraph.js'

export type ReturnedDisks = Record<string, number>

type TraversalOptions = {
    blocked: OffsetCoordinates
    placement?: OffsetCoordinates
}

export class Expropriator {
    graph: FreshFishGraph
    constructor(private readonly board: HydratedGameBoard) {
        this.graph = board.graph
    }

    calculateExpropriation(placement?: OffsetTupleCoordinates): {
        expropriatedCoords: OffsetTupleCoordinates[]
        returnedDisks: ReturnedDisks
    } {
        const expectedCount = this.graph.size
        const expropriated: { cell: Cell; coords: OffsetTupleCoordinates }[] = []
        for (const node of this.graph) {
            const cell = this.board.cellAt(node.coords)

            if (!cell || !canBeBlocked(cell)) {
                continue
            }

            const traverser = this.traverser({
                blocked: node.coords,
                placement: placement ? offsetTupleToOffset(placement) : undefined
            })
            const traversedNodes = Array.from(this.graph.traverse(traverser))

            if (traversedNodes.length !== expectedCount) {
                expropriated.push({ cell, coords: offsetToOffsetTuple(node.coords) })
            }
        }

        const expropriatedCoords = expropriated.map((location) => location.coords)
        const returnedDisks: ReturnedDisks = {}
        for (const location of expropriated) {
            if (isDiskCell(location.cell)) {
                returnedDisks[location.cell.playerId] =
                    (returnedDisks[location.cell.playerId] ?? 0) + 1
            }
        }
        return { expropriatedCoords, returnedDisks }
    }

    private traverser(options: TraversalOptions) {
        const startNode = Iterator.from(this.graph).find((node) => {
            const cell = this.board.cellAt(node.coords)
            return this.isValidStartCell(node.coords, options, cell)
        })

        if (!startNode) {
            return () => []
        }

        return breadthFirstTraverser({
            start: startNode,
            canTraverse: this.canTraverse.bind(this, options)
        })
    }

    private isValidStartCell(coords: OffsetCoordinates, options: TraversalOptions, cell?: Cell) {
        return (
            cell &&
            isTraversable(cell) &&
            !sameCoordinates(coords, options.blocked) &&
            (!options.placement || !sameCoordinates(coords, options.placement))
        )
    }

    private canTraverse(
        options: TraversalOptions,
        from: RectilinearGridNode,
        to: RectilinearGridNode
    ) {
        if (
            !areOrthogonal(from.coords, to.coords) ||
            sameCoordinates(from.coords, options.blocked) ||
            (options.placement && sameCoordinates(from.coords, options.placement))
        ) {
            return false
        }

        const fromCell = this.board.cellAt(from.coords)
        const toCell = this.board.cellAt(to.coords)
        if (!fromCell || !toCell) {
            return false
        }
        const traversable = isTraversable(fromCell)
        return traversable
    }
}
