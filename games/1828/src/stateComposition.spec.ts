import { expectTypeOf, it } from 'vitest'
import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'
import type { State1828 } from './state.js'

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
    expectTypeOf<State1828>().toHaveProperty('pendingPar')
    expectTypeOf<State1828>().toHaveProperty('accessRights')
    expectTypeOf<State1828>().toHaveProperty('systems')
    expectTypeOf<State1828>().not.toHaveProperty('offerAuction')
    expectTypeOf<State1828>().not.toHaveProperty('loanStep')
    expectTypeOf<State1828['companies'][number]>().not.toHaveProperty('loans')
})
