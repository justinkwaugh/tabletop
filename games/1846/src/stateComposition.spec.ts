import { expectTypeOf, it } from 'vitest'
import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'
import type { EighteenFortySixState, HydratedEighteenFortySixState } from './state.js'

stateCompositionTests(
    Definition,
    {
        tranches: [],
        ownershipLimitExemptions: [],
        interestRate: 0,
        loanStep: {},
        cashCrisis: {},
        companyAuction: {},
        offerAuction: {},
        selectionAuction: {},
        privatePowerWindow: {},
        privatePowerRequests: []
    },
    { loans: 1, role: 'mainline' }
)

it('exposes only this title’s declared state at compile time', () => {
    expectTypeOf<EighteenFortySixState>().toHaveProperty('draft')
    expectTypeOf<HydratedEighteenFortySixState>().toHaveProperty('draft')
    expectTypeOf<EighteenFortySixState>().not.toHaveProperty('offerAuction')
    expectTypeOf<HydratedEighteenFortySixState>().not.toHaveProperty('offerAuction')
    expectTypeOf<HydratedEighteenFortySixState['companies'][number]>().not.toHaveProperty('loans')
    expectTypeOf<EighteenFortySixState>().not.toHaveProperty('tranches')
})
