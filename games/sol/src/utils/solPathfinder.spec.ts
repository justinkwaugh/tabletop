import { Ring, SolGraph } from './solGraph.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { HydratedSolGameBoard } from '../components/gameBoard.js'
import { solPathfinder } from './solPathfinder.js'

interface LocalTestContext {
    board: HydratedSolGameBoard
}

describe('Sol Pathfinder Tests', () => {
    beforeEach<LocalTestContext>(async (context) => {
        // extend context
        context.board = new HydratedSolGameBoard({
            numPlayers: 4,
            motherships: {},
            cells: {},
            gates: {}
        })
    })

    it<LocalTestContext>('should find shortest path', ({ board }) => {
        const graph = new SolGraph(4)
        const pathFinder = solPathfinder({
            board,
            start: { row: Ring.Radiative, col: 0 },
            end: { row: Ring.Radiative, col: 4 }
        })
        const paths = graph.findPaths(pathFinder)
        expect(paths.length).toEqual(1)
        expect(paths[0].length).toEqual(5)
    })

    it<LocalTestContext>('should not find path out of range', ({ board }) => {
        const graph = new SolGraph(4)
        const pathFinder = solPathfinder({
            board,
            start: { row: Ring.Radiative, col: 0 },
            end: { row: Ring.Radiative, col: 4 },
            range: 2
        })
        const paths = graph.findPaths(pathFinder)
        expect(paths.length).toEqual(0)
    })

    it<LocalTestContext>('should find path through gates', ({ board }) => {
        const gate = {
            id: 'g1',
            playerId: 'p1'
        }
        board.addGateAt(gate, { row: Ring.Convective, col: 0 }, { row: Ring.Inner, col: 0 })
        const gate2 = {
            id: 'g2',
            playerId: 'p1'
        }
        board.addGateAt(gate2, { row: Ring.Radiative, col: 3 }, { row: Ring.Convective, col: 6 })

        const graph = new SolGraph(4)
        const pathFinder = solPathfinder({
            board,
            start: { row: Ring.Radiative, col: 0 },
            end: { row: Ring.Outer, col: 4 }
        })
        const paths = graph.findPaths(pathFinder)
        expect(paths.length).toEqual(1)
        expect(paths[0].length).toEqual(17)
    })
})
