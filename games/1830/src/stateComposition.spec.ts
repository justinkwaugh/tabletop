import { expectTypeOf, it } from 'vitest'
import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'
import type { EighteenThirtyState, HydratedEighteenThirtyState } from './state.js'

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
    expectTypeOf<EighteenThirtyState>().toHaveProperty('pendingPar')
    expectTypeOf<HydratedEighteenThirtyState>().toHaveProperty('pendingPar')
    expectTypeOf<EighteenThirtyState>().not.toHaveProperty('offerAuction')
    expectTypeOf<HydratedEighteenThirtyState>().not.toHaveProperty('offerAuction')
    expectTypeOf<EighteenThirtyState['companies'][number]>().not.toHaveProperty('loans')
    expectTypeOf<HydratedEighteenThirtyState['companies'][number]>().not.toHaveProperty('loans')
    expectTypeOf<EighteenThirtyState['companies'][number]>().not.toHaveProperty('role')
    expectTypeOf<HydratedEighteenThirtyState['companies'][number]>().not.toHaveProperty('role')
    expectTypeOf<EighteenThirtyState>().not.toHaveProperty('tranches')
    expectTypeOf<EighteenThirtyState>().not.toHaveProperty('ownershipLimitExemptions')
    expectTypeOf<EighteenThirtyState>().not.toHaveProperty('loanStep')
    expectTypeOf<HydratedEighteenThirtyState>().not.toHaveProperty('loanStep')
    expectTypeOf<
        Extract<EighteenThirtyState['certificates'][number], { kind: 'short' }>
    >().toBeNever()
    expectTypeOf<
        Extract<EighteenThirtyState['certificates'][number], { kind: 'share' }>
    >().not.toHaveProperty('number')
})
