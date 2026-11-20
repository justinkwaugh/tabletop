import { expectTypeOf, it } from 'vitest'
import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'
import type { StateRoyalGorge } from './state.js'

stateCompositionTests(
    Definition,
    {
        tranches: [],
        cashCrisis: {},
        offerAuction: {},
        openingAuction: {},
        privatePowerWindow: {},
        privatePowerRequests: []
    },
    { loans: 1, role: 'mainline' }
)

it('exposes only this title’s declared state at compile time', () => {
    expectTypeOf<StateRoyalGorge>().toHaveProperty('selectionAuction')
    expectTypeOf<StateRoyalGorge>().toHaveProperty('steelMarket')
    expectTypeOf<StateRoyalGorge>().not.toHaveProperty('openingAuction')
    expectTypeOf<StateRoyalGorge>().not.toHaveProperty('loanStep')
})
