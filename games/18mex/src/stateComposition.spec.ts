import { expectTypeOf, it } from 'vitest'
import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'
import type { HydratedStateMex, StateMex } from './state.js'

stateCompositionTests(
    Definition,
    {
        tranches: [],
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
    expectTypeOf<StateMex>().toHaveProperty('pendingPar')
    expectTypeOf<HydratedStateMex>().toHaveProperty('ndmMerger')
    expectTypeOf<StateMex>().toHaveProperty('openingAuction')
    expectTypeOf<StateMex>().not.toHaveProperty('selectionAuction')
    expectTypeOf<StateMex>().not.toHaveProperty('loanStep')
})
