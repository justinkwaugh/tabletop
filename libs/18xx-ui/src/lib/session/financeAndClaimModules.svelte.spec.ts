import { describe, expect, it } from 'vitest'
import { minimalPlayState, minimalStockRules } from '@tabletop/18xx/testing'
import {
    CorporateFinanceModule,
    type CorporateFinanceSession
} from './corporateFinanceModule.svelte.js'
import {
    PresidencyClaimModule,
    type PresidencyClaimSession
} from './presidencyClaimModule.svelte.js'
import { testSession } from './moduleTestSession.js'

describe('CorporateFinanceModule', () => {
    it('offers nothing to a title without corporate finance rules', () => {
        const state: CorporateFinanceSession['state'] = {
            ...minimalPlayState(),
            machineState: 'LayingTrack'
        }
        const module = new CorporateFinanceModule(testSession(state, {}, []).session)
        expect(module.choices).toEqual([])
        expect(module.holdings).toBeUndefined()
        expect(module.canApply).toBe(false)
    })

    it('applies a chosen transaction as one action', async () => {
        const state: CorporateFinanceSession['state'] = minimalPlayState()
        const { session, applied } = testSession(state, {}, ['CorporateFinance'])
        await new CorporateFinanceModule(session).apply({
            companyId: 'A',
            operation: 'redeem',
            shares: 2,
            amount: 60
        })
        expect(applied).toMatchObject([
            { type: 'CorporateFinance', companyId: 'A', operation: 'redeem', shares: 2, amount: 60 }
        ])
    })
})

describe('PresidencyClaimModule', () => {
    it('offers no claims without the title’s presidency claim rule', () => {
        const state: PresidencyClaimSession['state'] = minimalPlayState()
        const module = new PresidencyClaimModule(
            testSession(state, { stockRules: minimalStockRules }, ['ClaimPresidency']).session
        )
        expect(module.offers).toEqual([])
    })

    it('claims a presidency at the offered price', async () => {
        const state: PresidencyClaimSession['state'] = minimalPlayState()
        const { session, applied } = testSession(state, { stockRules: minimalStockRules }, [
            'ClaimPresidency'
        ])
        await new PresidencyClaimModule(session).claim({
            companyId: 'A',
            price: 70,
            claim: {
                companyId: 'A',
                next: { kind: 'player', playerId: 'alex' },
                presidentCertificateId: 'A:president',
                exchangedCertificateIds: ['A:1'],
                poolId: 'market'
            }
        })
        expect(applied).toMatchObject([
            { type: 'ClaimPresidency', companyId: 'A', expectedPrice: 70 }
        ])
    })
})
