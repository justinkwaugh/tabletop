import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
import {
    GameEngine,
    PlayerStatus,
    type GameDefinition,
    type HydratedGameState
} from '@tabletop/common'
import { expect, it } from 'vitest'

export function stateCompositionTests<
    Raw extends EighteenXXState,
    State extends HydratedEighteenXXState & HydratedGameState<Raw> & Raw
>(
    definition: GameDefinition<Raw, State>,
    unsupportedFields: Readonly<Record<string, unknown>>,
    unsupportedCompanyFields: Readonly<Record<string, unknown>>
) {
    const opening = () => {
        const game = definition.runtime.initializer.initializeGame(
            {
                id: 'state-composition',
                typeId: definition.info.id,
                ownerId: 'alex',
                seed: 1817,
                players: ['alex', 'blair', 'casey'].map((id) => ({
                    id,
                    name: id,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            },
            definition
        )
        return new GameEngine(definition.runtime).startGame(game).initialState
    }
    it('rejects unsupported mechanisms in canonical state and hydration', () => {
        const state = opening()
        for (const [field, value] of Object.entries(unsupportedFields)) {
            expect(state).not.toHaveProperty(field)
            const invalid = { ...state, [field]: value }
            expect(definition.runtime.canonicalStateValidator?.Check(invalid), field).toBe(false)
            expect(() => definition.runtime.hydrator.hydrateState(invalid), field).toThrow()
        }
        for (const [field, value] of Object.entries(unsupportedCompanyFields)) {
            const invalid = {
                ...state,
                companies: state.companies.map((company) => ({ ...company, [field]: value }))
            }
            expect(definition.runtime.canonicalStateValidator?.Check(invalid), field).toBe(false)
        }
    })

    it('hydrates an independent copy with exactly the title fields', () => {
        const state = opening()
        const hydrate = definition.runtime.hydrator.hydrateState
        const hydrated = hydrate(state)
        expect(hydrated.dehydrate()).toEqual(state)
        expect(hydrate(hydrated).dehydrate()).toEqual(state)
        hydrated.cash[0].amount = 0
        expect(state.cash[0].amount).not.toBe(0)
        expect(hydrated.turnManager.currentTurn()).toEqual(state.turnManager.series.at(-1))
    })
}
