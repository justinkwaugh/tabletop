import { expectTypeOf, it } from 'vitest'
import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'
import type { EighteenNinetyFourState } from './state.js'

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
    expectTypeOf<EighteenNinetyFourState>().toHaveProperty('pendingPar')
    expectTypeOf<EighteenNinetyFourState>().toHaveProperty('financeStep')
    expectTypeOf<EighteenNinetyFourState>().toHaveProperty('accessRights')
    expectTypeOf<EighteenNinetyFourState>().not.toHaveProperty('offerAuction')
    expectTypeOf<EighteenNinetyFourState>().not.toHaveProperty('loanStep')
    expectTypeOf<EighteenNinetyFourState['companies'][number]>().not.toHaveProperty('loans')
})
