import { expectTypeOf, it } from 'vitest'
import { stateCompositionTests } from '../../../libs/18xx/test/stateComposition.js'
import { Definition } from './definition/gameDefinition.js'
import type { HydratedShikoku1889State, Shikoku1889State } from './state.js'

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
        pendingPar: {},
        privateStation: {},
        stockTurnPurchases: []
    },
    { loans: 1, role: 'mainline' }
)

it('exposes only this title’s declared state at compile time', () => {
    expectTypeOf<Shikoku1889State>().toHaveProperty('openingAuction')
    expectTypeOf<HydratedShikoku1889State>().toHaveProperty('openingAuction')
    expectTypeOf<Shikoku1889State>().not.toHaveProperty('offerAuction')
    expectTypeOf<HydratedShikoku1889State>().not.toHaveProperty('offerAuction')
    expectTypeOf<Shikoku1889State['companies'][number]>().not.toHaveProperty('loans')
    expectTypeOf<HydratedShikoku1889State['companies'][number]>().not.toHaveProperty('loans')
    expectTypeOf<Shikoku1889State['companies'][number]>().not.toHaveProperty('role')
    expectTypeOf<HydratedShikoku1889State['companies'][number]>().not.toHaveProperty('role')
    expectTypeOf<Shikoku1889State>().not.toHaveProperty('tranches')
    expectTypeOf<Shikoku1889State>().not.toHaveProperty('ownershipLimitExemptions')
    expectTypeOf<Shikoku1889State>().not.toHaveProperty('loanStep')
    expectTypeOf<HydratedShikoku1889State>().not.toHaveProperty('loanStep')
    expectTypeOf<Extract<Shikoku1889State['certificates'][number], { kind: 'short' }>>().toBeNever()
    expectTypeOf<
        Extract<Shikoku1889State['certificates'][number], { kind: 'share' }>
    >().not.toHaveProperty('number')
})
