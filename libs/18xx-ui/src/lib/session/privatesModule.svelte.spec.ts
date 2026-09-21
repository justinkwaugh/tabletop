import { describe, expect, it } from 'vitest'
import {
    TestPlayerId,
    minimalCompanyRules,
    minimalPlayState,
    minimalPrivateRules,
    minimalStockRules
} from '@tabletop/18xx/testing'
import { PrivatesModule, type PrivatesSession } from './privatesModule.svelte.js'
import { testSession } from './moduleTestSession.js'

const request = { playerId: TestPlayerId, privateCompanyId: 'P', certificateId: 'R:share:1' }

function privates(availability = {}) {
    const base = minimalPlayState()
    const state: PrivatesSession['state'] = {
        ...base,
        usedPrivatePowerIds: [],
        companies: [...base.companies, { id: 'P', name: 'Private', kind: 'private' }]
    }
    const harness = testSession(
        state,
        {
            privateRules: minimalPrivateRules,
            stockRules: minimalStockRules,
            companyRules: minimalCompanyRules
        },
        [],
        availability
    )
    return { ...harness, module: new PrivatesModule(harness.session) }
}

describe('PrivatesModule', () => {
    it('lists private companies with the title description', () => {
        expect(privates().module.companies).toMatchObject([{ id: 'P', description: 'About P' }])
    })

    it('offers no exchange when the title grants none, or while interaction is blocked', () => {
        expect(privates().module.exchangeOffers).toEqual([])
        expect(privates({ interactive: false }).module.exchangeOffers).toEqual([])
    })

    it('refuses an exchange that is not on offer and keeps nothing pending', () => {
        const { module } = privates()
        expect(() => module.selectExchange(request)).toThrow('Choose an available private exchange')
        expect(module.exchangeChoice.hasManual()).toBe(false)
        expect(module.exchangeChoice.undo()).toBe(false)
    })

    it('refuses to confirm without a selection', async () => {
        await expect(privates().module.confirmExchange()).rejects.toThrow(
            'Choose an available private exchange'
        )
    })
})
