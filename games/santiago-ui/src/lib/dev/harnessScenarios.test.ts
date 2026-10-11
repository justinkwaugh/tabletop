import { describe, expect, it } from 'vitest'
import { assert, assertExists, type HydratedGameState } from '@tabletop/common'
import { playHarnessScenario, type HarnessScenario } from '@tabletop/frontend-components'
import {
    Definition,
    HydratedSantiagoGameState,
    MachineState,
    connectedSpringIntersections,
    isFieldSquare,
    isIrrigated,
    tilesPerRound
} from '@tabletop/santiago'
import { santiagoHarnessScenarios } from './harnessScenarios.js'

const SEEDS = [
    '0123456789abcdef0123456789abcdef',
    'fedcba9876543210fedcba9876543210',
    'c0ffee'.padEnd(32, '0')
]

function scenarioById(id: string): HarnessScenario {
    const scenario = santiagoHarnessScenarios.find((candidate) => candidate.id === id)
    assertExists(scenario, `Missing scenario ${id}`)
    return scenario
}

// Plays a policy on a fixed seed and returns the board it stopped on, counted.
function play(id: string, masterSeed: string) {
    const scenario = scenarioById(id)
    let reached: HydratedGameState | undefined
    playHarnessScenario({
        title: Definition,
        scenario: {
            ...scenario,
            seed: { masterSeed },
            isComplete: (state, progress) => {
                reached = state
                return scenario.isComplete(state, progress)
            }
        }
    })
    assert(reached instanceof HydratedSantiagoGameState, 'Santiago state is required')
    const state = reached
    const connected = connectedSpringIntersections(state.board)
    let fields = 0
    let dried = 0
    let thirsty = 0
    state.board.squares.forEach((column, col) =>
        column.forEach((square, row) => {
            if (!isFieldSquare(square)) return
            fields++
            if (square.dried) dried++
            else if (square.farmerCount === 0 && !isIrrigated(state.board, col, row, connected)) {
                thirsty++
            }
        })
    )
    return { state, fields, dried, thirsty }
}

describe.each(SEEDS)('Santiago scenario policies (seed %s)', (seed) => {
    it('keeps a mid-game board healthy', () => {
        const { state, fields, dried } = play('midgame-healthy', seed)
        expect(state.machineState).toBe(MachineState.TileReveal)
        expect(state.round).toBeGreaterThanOrEqual(6)
        expect(dried * 10).toBeLessThanOrEqual(fields)
    })

    it('dries out a late-game board', () => {
        const { state, fields, dried } = play('late-drought', seed)
        expect(state.machineState).toBe(MachineState.TileReveal)
        expect(state.round).toBeGreaterThanOrEqual(8)
        expect(fields).toBeGreaterThanOrEqual(24)
        expect(dried * 2).toBeGreaterThanOrEqual(fields)
    })

    it('reaches the final round on a healthy board', () => {
        const { state, fields, dried } = play('final-round', seed)
        expect(state.machineState).toBe(MachineState.TileReveal)
        expect(state.getRemainingTileCount()).toBeLessThanOrEqual(
            tilesPerRound(state.players.length)
        )
        expect(dried * 10).toBeLessThanOrEqual(fields)
    })

    it('waits on the last personal-canal decision before a drought', () => {
        const { state, thirsty } = play('before-drought', seed)
        expect(state.machineState).toBe(MachineState.ExtraIrrigation)
        expect(state.extraIrrigationIndex).toBe(state.extraIrrigationOrder.length - 1)
        expect(thirsty).toBeGreaterThan(0)
    })
})
