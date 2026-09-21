import { expect, it } from 'vitest'
import { GameEngine, PlayerStatus, assertExists, type GameDefinition } from '@tabletop/common'
import {
    EighteenXXState,
    type HydratedEighteenXXState
} from '@tabletop/18xx'

export function machineStateCoverageTests(
    definition: GameDefinition<EighteenXXState, HydratedEighteenXXState>,
    unsupportedMachineStates: readonly EighteenXXState['machineState'][]
) {
    const runtime = definition.runtime
    const validator = runtime.canonicalStateValidator
    assertExists(validator, 'The runtime validates canonical state')
    const game = runtime.initializer.initializeGame(
        {
            id: 'machine-states',
            typeId: definition.info.id,
            ownerId: 'alex',
            seed: 1889,
            players: ['alex', 'blair', 'casey'].map((id) => ({
                id,
                name: id,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        definition
    )
    const state = new GameEngine(runtime).startGame(game).initialState
    const familyMachineStates = EighteenXXState.properties.machineState.anyOf.map(
        (literal) => literal.const
    )

    it('accepts exactly the machine states that have a handler', () => {
        expect(validator.Check(state)).toBe(true)
        for (const machineState of familyMachineStates)
            expect(validator.Check({ ...state, machineState }), machineState).toBe(
                machineState in runtime.stateHandlers
            )
    })

    it('rejects the auction this title does not use', () => {
        expect(unsupportedMachineStates.length).toBeGreaterThan(0)
        for (const machineState of unsupportedMachineStates) {
            expect(runtime.stateHandlers[machineState], machineState).toBeUndefined()
            expect(validator.Check({ ...state, machineState }), machineState).toBe(false)
        }
    })
}
