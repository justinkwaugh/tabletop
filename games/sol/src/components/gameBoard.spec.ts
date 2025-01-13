import { Ring } from '../utils/solGraph.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { HydratedSolGameBoard } from '../components/gameBoard.js'

interface LocalTestContext {
    board: HydratedSolGameBoard
}

describe('Sol Game Board Tests', () => {
    beforeEach<LocalTestContext>(async (context) => {
        // extend context
        context.board = new HydratedSolGameBoard({
            numPlayers: 4,
            motherships: {},
            cells: {},
            gates: {}
        })
    })

    it<LocalTestContext>('should find only local gate choices', ({ board }) => {
        const gate = {
            id: 'g1',
            playerId: 'p1'
        }
        board.addGateAt(gate, { row: Ring.Convective, col: 0 }, { row: Ring.Inner, col: 0 })
        const gate2 = {
            id: 'g2',
            playerId: 'p2'
        }
        board.addGateAt(gate2, { row: Ring.Convective, col: 2 }, { row: Ring.Inner, col: 2 })
        const gate3 = {
            id: 'g3',
            playerId: 'p1'
        }
        board.addGateAt(gate3, { row: Ring.Radiative, col: 2 }, { row: Ring.Convective, col: 3 })
        const gate4 = {
            id: 'g4',
            playerId: 'p2'
        }
        board.addGateAt(gate4, { row: Ring.Radiative, col: 5 }, { row: Ring.Convective, col: 8 })

        const start = { row: Ring.Radiative, col: 7 }
        const end = { row: Ring.Outer, col: 4 }
        const gates = board.gateChoicesForDestination(start, end, 50)
        expect(gates.length).toEqual(2)
    })

    it<LocalTestContext>('should find only one gate choice due to range', ({ board }) => {
        const gate = {
            id: 'g1',
            playerId: 'p1'
        }
        board.addGateAt(gate, { row: Ring.Convective, col: 0 }, { row: Ring.Inner, col: 0 })
        const gate2 = {
            id: 'g2',
            playerId: 'p2'
        }
        board.addGateAt(gate2, { row: Ring.Convective, col: 2 }, { row: Ring.Inner, col: 2 })

        const start = { row: Ring.Convective, col: 0 }
        const end = { row: Ring.Inner, col: 11 }
        const gates = board.gateChoicesForDestination(start, end, 4)
        expect(gates.length).toEqual(1)
        expect(gates[0].id).toEqual(gate.id)
    })

    it<LocalTestContext>('should find gate choices even for same ring', ({ board }) => {
        const gate = {
            id: 'g1',
            playerId: 'p1'
        }
        board.addGateAt(gate, { row: Ring.Convective, col: 0 }, { row: Ring.Inner, col: 0 })
        const gate2 = {
            id: 'g2',
            playerId: 'p2'
        }
        board.addGateAt(gate2, { row: Ring.Convective, col: 12 }, { row: Ring.Inner, col: 11 })

        const start = { row: Ring.Convective, col: 0 }
        const end = { row: Ring.Convective, col: 5 }
        const gates = board.gateChoicesForDestination(start, end, 7)
        expect(gates.length).toEqual(1)
        expect(gates[0].id).toEqual(gate.id)
    })

    it<LocalTestContext>('should find gate choice with target at gate', ({ board }) => {
        const gate = {
            id: 'g1',
            playerId: 'p1'
        }
        board.addGateAt(gate, { row: Ring.Convective, col: 2 }, { row: Ring.Inner, col: 2 })

        const start = { row: Ring.Convective, col: 0 }
        const end = { row: Ring.Inner, col: 2 }
        const gates = board.gateChoicesForDestination(start, end, 3)
        expect(gates.length).toEqual(1)
        expect(gates[0].id).toEqual(gate.id)
    })
})
