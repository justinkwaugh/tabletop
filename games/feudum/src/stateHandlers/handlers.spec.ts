import { ActionSource } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { isStartRound } from '../actions/startRound.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { Table } from '../testing/table.js'

const Goods = ['saltpeter', 'sulfur', 'iron']
const Pawn = { character: 'farmer', spaceId: 'space.desert.3' }
const Seats = [2, 3, 4, 5]

function tableAtPawns(numPlayers: number): Table {
    const table = new Table(numPlayers)
    for (const playerId of table.order) {
        table.send(playerId, { type: ActionType.ChooseStartingGoods, goods: Goods })
    }
    return table
}

describe('Setup states', () => {
    it.each(Seats)('R-1.4.8 goods are asked of each of %i seats in turn order', (numPlayers) => {
        const table = new Table(numPlayers)
        for (const playerId of table.order) {
            expect(table.state.machineState).toBe(MachineState.ChoosingStartingGoods)
            expect(table.state.flow.setupOrder).toEqual({ playerId })
            expect(table.state.activePlayerIds).toEqual([playerId])
            for (const other of table.order) {
                expect(table.offered(other)).toEqual(
                    other === playerId ? [ActionType.ChooseStartingGoods] : []
                )
            }
            table.send(playerId, { type: ActionType.ChooseStartingGoods, goods: Goods })
        }
        expect(table.state.machineState).toBe(MachineState.PlacingStartingPawn)
        expect(table.state.flow.setupOrder).toEqual({ playerId: table.order[0] })
    })

    it.each(Seats)('R-1.4.9 pawns are asked of each of %i seats in turn order', (numPlayers) => {
        const table = tableAtPawns(numPlayers)
        for (const playerId of table.order) {
            expect(table.state.machineState).toBe(MachineState.PlacingStartingPawn)
            expect(table.state.flow.setupOrder).toEqual({ playerId })
            expect(table.state.activePlayerIds).toEqual([playerId])
            for (const other of table.order) {
                expect(table.offered(other)).toEqual(
                    other === playerId ? [ActionType.PlaceStartingPawn] : []
                )
            }
            table.send(playerId, { type: ActionType.PlaceStartingPawn, ...Pawn })
        }
    })

    it('R-1.4.8 a seat out of order is refused', () => {
        const table = new Table()
        const [, second] = table.order
        expect(() =>
            table.send(second, { type: ActionType.ChooseStartingGoods, goods: Goods })
        ).toThrow()
    })

    it('R-1.4.9, R-2.2 only the last pawn runs StartRound, as a System Action', () => {
        const table = tableAtPawns(3)
        const [first, second, third] = table.order
        expect(table.send(first, { type: ActionType.PlaceStartingPawn, ...Pawn })).toHaveLength(1)
        expect(table.send(second, { type: ActionType.PlaceStartingPawn, ...Pawn })).toHaveLength(1)

        const processed = table.send(third, { type: ActionType.PlaceStartingPawn, ...Pawn })

        expect(processed.map((action) => action.type)).toEqual([
            ActionType.PlaceStartingPawn,
            ActionType.StartRound
        ])
        expect(isStartRound(processed[1])).toBe(true)
        expect(processed[1].source).toBe(ActionSource.System)
    })

    it('R-1.4.9, R-2.2 setup closes into round 1 with the first seat selecting', () => {
        const table = tableAtPawns(3)
        for (const playerId of table.order) {
            table.send(playerId, { type: ActionType.PlaceStartingPawn, ...Pawn })
        }
        expect(table.state.flow.setupOrder).toBeUndefined()
        expect(table.state.machineState).toBe(MachineState.SelectingHands)
        expect(table.hydrated().roundManager.currentRound?.number).toBe(1)
        expect(table.hydrated().phaseManager.currentPhase?.name).toBe(PhaseName.HandSelection)
        expect(table.state.phaseManager.series.map((phase) => phase.name)).toEqual([
            PhaseName.Setup,
            PhaseName.HandSelection
        ])
        expect(table.state.flow.selection).toEqual({ playerId: table.order[0], finalised: [] })
        expect(table.asked).toBe(table.order[0])
    })
})
