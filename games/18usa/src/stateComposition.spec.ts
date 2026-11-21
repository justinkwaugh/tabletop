import { expectTypeOf, it } from 'vitest'
import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'
import type { EighteenUSAState, HydratedEighteenUSAState } from './state.js'

stateCompositionTests(
    Definition,
    {
        tranches: [],
        ownershipLimitExemptions: [],
        offerAuction: {},
        openingAuction: {},
        pendingPar: {},
        privateStation: {},
        privatePowerWindow: {},
        privatePowerRequests: []
    },
    { role: 'mainline' }
)

it('exposes only this title’s declared state at compile time', () => {
    expectTypeOf<EighteenUSAState>().toHaveProperty('loanStep')
    expectTypeOf<HydratedEighteenUSAState>().toHaveProperty('loanStep')
    expectTypeOf<EighteenUSAState>().not.toHaveProperty('offerAuction')
    expectTypeOf<HydratedEighteenUSAState>().not.toHaveProperty('offerAuction')
    expectTypeOf<EighteenUSAState['companies'][number]>().not.toHaveProperty('role')
    expectTypeOf<HydratedEighteenUSAState['companies'][number]>().not.toHaveProperty('role')
    expectTypeOf<EighteenUSAState>().not.toHaveProperty('tranches')
    expectTypeOf<EighteenUSAState>().not.toHaveProperty('ownershipLimitExemptions')
    expectTypeOf<
        Extract<EighteenUSAState['certificates'][number], { kind: 'share' }>
    >().not.toHaveProperty('number')
})
