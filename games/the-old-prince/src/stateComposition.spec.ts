import { expectTypeOf, it } from 'vitest'
import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'
import type { HydratedTheOldPrinceState, TheOldPrinceState } from './state.js'

stateCompositionTests(
    Definition,
    {
        interestRate: 0,
        loanStep: {},
        cashCrisis: {},
        companyAuction: {},
        openingAuction: {},
        selectionAuction: {},
        pendingPar: {},
        privateStation: {}
    },
    { loans: 1 }
)

it('exposes only this title’s declared state at compile time', () => {
    expectTypeOf<TheOldPrinceState>().not.toHaveProperty('usedPrivatePowerIds')
    expectTypeOf<TheOldPrinceState>().toHaveProperty('offerAuction')
    expectTypeOf<HydratedTheOldPrinceState>().toHaveProperty('offerAuction')
    expectTypeOf<TheOldPrinceState>().not.toHaveProperty('openingAuction')
    expectTypeOf<HydratedTheOldPrinceState>().not.toHaveProperty('openingAuction')
    expectTypeOf<TheOldPrinceState['companies'][number]>().not.toHaveProperty('loans')
    expectTypeOf<HydratedTheOldPrinceState['companies'][number]>().not.toHaveProperty('loans')
    expectTypeOf<TheOldPrinceState>().not.toHaveProperty('loanStep')
    expectTypeOf<HydratedTheOldPrinceState>().not.toHaveProperty('loanStep')
    expectTypeOf<
        Extract<TheOldPrinceState['certificates'][number], { kind: 'short' }>
    >().toBeNever()
})
