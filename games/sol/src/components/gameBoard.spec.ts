import { Ring } from '../utils/solGraph.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { HydratedSolGameBoard } from '../components/gameBoard.js'
import { SolarGate } from './solarGate.js'

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

        const gate5 = {
            id: 'g5',
            playerId: 'p2'
        }
        board.addGateAt(gate5, { row: Ring.Core, col: 1 }, { row: Ring.Radiative, col: 2 })

        const start = { row: Ring.Radiative, col: 7 }
        const end = { row: Ring.Outer, col: 4 }

        const localGates = board.findGatesLocalToRing(start.row)

        expect(localGates.length).toEqual(3)
        expect(localGates).toContainEqual(gate3)
        expect(localGates).toContainEqual(gate4)
        expect(localGates).toContainEqual(gate5)
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
        const choiceData = board.gateChoicesForDestination({ start, end, range: 4 })
        expect(choiceData.gates.length).toEqual(1)
        expect(choiceData.gates[0].id).toEqual(gate.id)
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

        // Not enough range to go out and back in
        let choiceData = board.gateChoicesForDestination({ start, end, range: 7 })
        expect(choiceData.gates.length).toEqual(0)

        // Enough range to go out and back in
        choiceData = board.gateChoicesForDestination({ start, end, range: 11 })
        expect(choiceData.gates.length).toEqual(1)
        expect(choiceData.gates[0].id).toEqual(gate.id)
    })

    it<LocalTestContext>('should find gate choice with target at gate', ({ board }) => {
        const gate = {
            id: 'g1',
            playerId: 'p1'
        }
        board.addGateAt(gate, { row: Ring.Convective, col: 2 }, { row: Ring.Inner, col: 2 })

        const start = { row: Ring.Convective, col: 0 }
        const end = { row: Ring.Inner, col: 2 }
        const choiceData = board.gateChoicesForDestination({ start, end, range: 3 })
        expect(choiceData.gates.length).toEqual(1)
        expect(choiceData.gates[0].id).toEqual(gate.id)
    })

    it<LocalTestContext>('calculates path through defined gates', ({ board }) => {
        const gate: SolarGate = {
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
            playerId: 'p2'
        }
        board.addGateAt(gate3, { row: Ring.Radiative, col: 7 }, { row: Ring.Convective, col: 0 })

        const start = { row: Ring.Inner, col: 0 }
        const end = { row: Ring.Radiative, col: 4 }

        const gates = [gate2, gate3]
        const path = board.pathToDestination({ start, destination: end, requiredGates: gates })
        expect(path).toBeDefined()
        expect(path!.length).toEqual(10)
    })

    it<LocalTestContext>('returns progressive gate choices', ({ board }) => {
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

        const gate5 = {
            id: 'g5',
            playerId: 'p2'
        }
        board.addGateAt(gate5, { row: Ring.Core, col: 1 }, { row: Ring.Radiative, col: 2 })

        const start = { row: Ring.Outer, col: 6 }
        const end = { row: Ring.Core, col: 0 }

        const choiceData = board.gateChoicesForDestination({ start, end, range: 50 })

        expect(choiceData.gates.length).toEqual(2)
        expect(choiceData.gates[0]).toEqual(gate)
        expect(choiceData.gates[1]).toEqual(gate2)

        const requiredGates = [gate]
        const nextChoiceData = board.gateChoicesForDestination({
            start,
            end,
            range: 50,
            requiredGates
        })

        expect(nextChoiceData.gates.length).toEqual(2)
        expect(nextChoiceData.gates[0]).toEqual(gate3)
        expect(nextChoiceData.gates[1]).toEqual(gate4)

        requiredGates.push(gate3)
        const finalChoiceData = board.gateChoicesForDestination({
            start,
            end,
            range: 50,
            requiredGates
        })

        expect(finalChoiceData.gates.length).toEqual(1)
        expect(finalChoiceData.gates[0]).toEqual(gate5)
    })
})
