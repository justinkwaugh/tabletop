import { describe, expect, it } from 'vitest'
import { WorkerActionType, type HydratedBusGameState } from '@tabletop/bus'
import { resolvePlacedActionValue } from './actionWorkerValues.js'

function createState(
    overrides: Partial<HydratedBusGameState> = {}
): HydratedBusGameState {
    return {
        players: [
            { playerId: 'p1', buses: 2, sticks: 5 },
            { playerId: 'p2', buses: 1, sticks: 5 }
        ],
        busAction: undefined,
        roundStartMaxBusValue: 2,
        maxBusValue: () => 2,
        currentBuildingPhase: 1,
        board: {
            openSitesForPhase: () => []
        },
        lineExpansionAction: [],
        passengersAction: [],
        buildingAction: [],
        passengers: [{ id: 'passenger-1' }],
        ...overrides
    } as unknown as HydratedBusGameState
}

describe('resolvePlacedActionValue', () => {
    it('caps passenger slots by the remaining passenger pool after earlier slots', () => {
        const state = createState({
            passengersAction: ['p1', 'p2']
        })

        expect(
            resolvePlacedActionValue({
                state,
                actionType: WorkerActionType.Passengers,
                selectionIndex: 0,
                playerId: 'p1',
                myPlayerId: 'p1'
            })
        ).toBe(1)

        expect(
            resolvePlacedActionValue({
                state,
                actionType: WorkerActionType.Passengers,
                selectionIndex: 1,
                playerId: 'p2',
                myPlayerId: 'p1'
            })
        ).toBe(0)
    })
})
