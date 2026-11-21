import { expectTypeOf, it } from 'vitest'
import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'
import type { HydratedState1860, State1860 } from './state.js'

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
        openingAuction: {},
        trainFunding: {},
        privatePowerWindow: {},
        privatePowerRequests: []
    },
    { loans: 1, role: 'mainline' }
)

it('exposes only this title’s declared state at compile time', () => {
    expectTypeOf<State1860>().toHaveProperty('insolventIds')
    expectTypeOf<HydratedState1860>().toHaveProperty('choiceAuction')
    expectTypeOf<State1860>().not.toHaveProperty('openingAuction')
    expectTypeOf<State1860>().not.toHaveProperty('trainFunding')
})
