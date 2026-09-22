import { describe, expect, it } from 'vitest'
import { createOrdinaryShareCertificates } from '@tabletop/18xx'
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
    it.each([false, true])(
        'groups equivalent exchange shares, preserves numbered identities (%s), and commits the chosen certificate',
        async (numbered) => {
            const { session, applied } = privates()
            const bank = { owner: { kind: 'bank' as const }, poolId: 'market' }
            session.state.companies.push({
                id: 'S',
                name: 'Second railway',
                kind: 'major',
                shareCount: 10
            })
            session.state.certificates.push(
                {
                    id: 'P:charter',
                    companyId: 'P',
                    kind: 'private',
                    certificateLimitCount: 1,
                    retired: false,
                    owner: { kind: 'player', playerId: TestPlayerId }
                },
                ...createOrdinaryShareCertificates('R', [bank, bank], bank),
                ...createOrdinaryShareCertificates('S', [bank, bank], bank)
            )
            if (numbered) {
                for (const certificate of session.state.certificates) {
                    if (certificate.kind === 'share' && certificate.id === 'R:share:2')
                        certificate.number = 2
                }
            }
            const module = new PrivatesModule({
                ...session,
                rules: {
                    ...session.rules,
                    privateRules: {
                        ...minimalPrivateRules,
                        exchangeTerms: () => ({
                            certificateIds: session.state.certificates
                                .filter((cert) => cert.kind === 'share' && !cert.president)
                                .map((cert) => cert.id),
                            timing: 'own-stock-turn',
                            stockAction: 'additional',
                            ownershipLimit: 'ordinary'
                        })
                    }
                }
            })
            expect(module.exchangeOffers).toHaveLength(4)
            expect(module.exchangeOptions.map((offer) => offer.certificateId)).toEqual([
                'R:share:1',
                ...(numbered ? ['R:share:2'] : []),
                'S:share:1'
            ])
            module.selectExchange(module.exchangeOptions[module.exchangeOptions.length - 1])
            await module.confirmExchange()
            expect(applied[0]).toMatchObject({
                type: 'ExchangePrivate',
                privateCompanyId: 'P',
                certificateId: 'S:share:1'
            })
        }
    )

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
