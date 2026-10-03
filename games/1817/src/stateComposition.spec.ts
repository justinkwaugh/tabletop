import { expectTypeOf, it } from 'vitest'
import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'
import type { EighteenSeventeenState, HydratedEighteenSeventeenState } from './state.js'

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
    expectTypeOf<EighteenSeventeenState>().toHaveProperty('loanStep')
    expectTypeOf<HydratedEighteenSeventeenState>().toHaveProperty('loanStep')
    expectTypeOf<EighteenSeventeenState>().not.toHaveProperty('offerAuction')
    expectTypeOf<HydratedEighteenSeventeenState>().not.toHaveProperty('offerAuction')
    expectTypeOf<EighteenSeventeenState['companies'][number]>().not.toHaveProperty('role')
    expectTypeOf<HydratedEighteenSeventeenState['companies'][number]>().not.toHaveProperty('role')
    expectTypeOf<EighteenSeventeenState>().not.toHaveProperty('tranches')
    expectTypeOf<EighteenSeventeenState>().not.toHaveProperty('ownershipLimitExemptions')
    expectTypeOf<
        Extract<EighteenSeventeenState['certificates'][number], { kind: 'share' }>
    >().not.toHaveProperty('number')
})
