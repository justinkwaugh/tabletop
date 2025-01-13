import { ONE_TO_FOUR_PLAYER_RING_COUNTS, Ring, SolGraph } from './solGraph.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { HydratedSolGameBoard } from '../components/gameBoard.js'
import { solTraverser } from './solTraverser.js'

interface LocalTestContext {
    board: HydratedSolGameBoard
}

describe('Sol Traverser Tests', () => {
    beforeEach<LocalTestContext>(async (context) => {
        // extend context
        context.board = new HydratedSolGameBoard({
            numPlayers: 4,
            motherships: {},
            cells: {},
            gates: {}
        })
    })

    it<LocalTestContext>('should be blocked by rings', ({ board }) => {
        const graph = new SolGraph(4)
        const coreTraverser = solTraverser({ board, start: { row: Ring.Core, col: 0 } })
        expect(Array.from(graph.traverse(coreTraverser)).length).toEqual(
            ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Core]
        )

        const radiativeTraverser = solTraverser({ board, start: { row: Ring.Radiative, col: 0 } })
        expect(Array.from(graph.traverse(radiativeTraverser)).length).toEqual(
            ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Radiative]
        )

        const convectiveTraverser = solTraverser({ board, start: { row: Ring.Convective, col: 0 } })
        expect(Array.from(graph.traverse(convectiveTraverser)).length).toEqual(
            ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Convective]
        )

        const outerTraverser = solTraverser({ board, start: { row: Ring.Outer, col: 0 } })
        expect(Array.from(graph.traverse(outerTraverser)).length).toEqual(
            ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Outer] + ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Inner]
        )
    })

    it<LocalTestContext>('should allow gate passage', ({ board }) => {
        const gate = {
            id: 'g1',
            playerId: 'p1'
        }
        board.addGateAt(gate, { row: Ring.Convective, col: 0 }, { row: Ring.Inner, col: 0 })

        const graph = new SolGraph(4)

        const nodeCount =
            ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Convective] +
            ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Inner] +
            ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Outer]
        const convectiveTraverser = solTraverser({ board, start: { row: Ring.Convective, col: 4 } })
        expect(Array.from(graph.traverse(convectiveTraverser)).length).toEqual(nodeCount)

        const outerTraverser = solTraverser({ board, start: { row: Ring.Outer, col: 10 } })
        expect(Array.from(graph.traverse(outerTraverser)).length).toEqual(nodeCount)
    })
})
