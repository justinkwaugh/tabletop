import { expectTypeOf, it } from 'vitest'
import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'
import type { EighteenThirtyTwoState, HydratedEighteenThirtyTwoState } from './state.js'

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
    expectTypeOf<EighteenThirtyTwoState>().toHaveProperty('pendingPar')
    expectTypeOf<HydratedEighteenThirtyTwoState>().toHaveProperty('pendingPar')
    expectTypeOf<EighteenThirtyTwoState>().not.toHaveProperty('offerAuction')
    expectTypeOf<EighteenThirtyTwoState>().not.toHaveProperty('loanStep')
    expectTypeOf<EighteenThirtyTwoState['companies'][number]>().not.toHaveProperty('loans')
})
