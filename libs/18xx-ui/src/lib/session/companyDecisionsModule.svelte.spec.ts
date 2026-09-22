import { describe, expect, it } from 'vitest'
import {
    TestCompanyId,
    TestPlayerId,
    TestTrackHomeLocationId,
    minimalPlayState,
    minimalTrackRules,
    minimalTrackTileSet,
    minimalTrainRules,
    minimalTransferRules
} from '@tabletop/18xx/testing'
import {
    CompanyDecisionsModule,
    type CompanyDecisionsSession
} from './companyDecisionsModule.svelte.js'
import { testSession } from './moduleTestSession.js'

const PrivateId = 'tramway'
type State = CompanyDecisionsSession['state']

function deciding(valid: string[], pending: Partial<State> = {}, availability = {}) {
    const base = minimalPlayState()
    const state: State = {
        ...base,
        machineState: 'LayingTrack',
        companies: [
            ...base.companies.map((company) => ({ ...company, floated: true })),
            { id: PrivateId, name: 'Tramway', kind: 'private', shareCount: 1 }
        ],
        cash: [...base.cash, { owner: { kind: 'company', companyId: TestCompanyId }, amount: 100 }],
        tileInventory: minimalTrackTileSet.createInventory(),
        stations: [
            {
                id: `${TestCompanyId}:home`,
                companyId: TestCompanyId,
                status: 'placed',
                position: { locationId: TestTrackHomeLocationId, nodeId: 'city', slot: 0 }
            }
        ],
        usedPrivatePowerIds: [],
        ...pending
    }
    const rules: CompanyDecisionsSession['rules'] = {
        trainRules: minimalTrainRules,
        transferRules: {
            ...minimalTransferRules,
            priceRange: () => ({ minimum: 10, maximum: 60 })
        },
        trackRules: minimalTrackRules(),
        privatePowerRules: {
            trackTerms: (_state, privateCompanyId, playerId) =>
                privateCompanyId === PrivateId && playerId === TestPlayerId
                    ? {
                          companyId: TestCompanyId,
                          locationIds: ['0,-1'],
                          definitionIds: ['18xx:9'],
                          payer: { kind: 'company', companyId: TestCompanyId },
                          connected: true
                      }
                    : undefined,
            earlyTrainCompany: () => undefined
        }
    }
    const harness = testSession(state, rules, valid, availability)
    return { ...harness, module: new CompanyDecisionsModule(harness.session) }
}
const purchase = {
    companyId: TestCompanyId,
    seller: { kind: 'player', playerId: TestPlayerId },
    asset: { kind: 'private', privateCompanyId: PrivateId },
    price: 10
} as const

describe('CompanyDecisionsModule', () => {
    it('offers the private tile lays the title grants the acting player', () => {
        const { module } = deciding(['LayPrivateTile'])
        expect(module.privateTileOptions.length).toBeGreaterThan(0)
        expect(module.privateTileOptions[0]).toMatchObject({
            privateCompanyId: PrivateId,
            playerId: TestPlayerId,
            details: { locationId: '0,-1', definitionId: '18xx:9' }
        })
    })

    it('offers no private tile lays once the power is used or the session is not interactive', () => {
        expect(
            deciding([], { usedPrivatePowerIds: [PrivateId] }).module.privateTileOptions
        ).toEqual([])
        expect(deciding([], {}, { interactive: false }).module.privateTileOptions).toEqual([])
    })

    it('lays a private tile as the entitled player with the evaluated cost', async () => {
        const { module, applied } = deciding(['LayPrivateTile'])
        module.selectPrivateTile(module.privateTileOptions[0])
        expect(module.selection?.kind).toBe('tile')
        await module.confirm()
        expect(applied).toHaveLength(1)
        expect(applied[0]).toMatchObject({
            type: 'LayPrivateTile',
            playerId: TestPlayerId,
            privateCompanyId: PrivateId,
            companyId: TestCompanyId,
            expectedCost: 0
        })
    })

    it('refuses a private tile lay for a player who may not act', () => {
        const { module } = deciding(['LayPrivateTile'])
        expect(() =>
            module.selectPrivateTile({ ...module.privateTileOptions[0], playerId: 'blake' })
        ).toThrow()
    })

    it('starts a private purchase at the most the company can pay within the title range', () => {
        const { module } = deciding(['OfferPurchase'])
        module.selectPurchaseOffer(purchase)
        expect(module.selection).toMatchObject({ kind: 'purchase', request: { price: 60 } })
        module.setPurchasePrice(25)
        expect(module.selection).toMatchObject({ kind: 'purchase', request: { price: 25 } })
        expect(module.purchaseOfferEvaluation).toBeDefined()
    })

    it('treats the decision as one manual choice that Undo and Back both clear', () => {
        const { module } = deciding(['OfferPurchase'])
        module.selectPurchaseOffer(purchase)
        expect(module.choice.undo()).toBe(true)
        expect(module.selection).toBeUndefined()
        module.selectPurchaseOffer(purchase)
        module.back()
        expect(module.choice.hasManual()).toBe(false)
        expect(() => module.setPurchasePrice(20)).toThrow()
    })

    it('refuses to stage a purchase when offering is not a valid action', () => {
        expect(() => deciding([]).module.selectPurchaseOffer(purchase)).toThrow()
        expect(deciding([]).module.purchaseOptions).toEqual([])
    })

    it('answers the pending request it is shown, and nothing when none is pending', async () => {
        const window = deciding(['ContinueOperatingRound'], {
            privatePowerWindow: { companyId: TestCompanyId, passedPlayerIds: [] }
        })
        await window.module.continueOperatingRound()
        expect(window.applied[0]).toMatchObject({
            type: 'ContinueOperatingRound',
            companyId: TestCompanyId
        })

        const lay = deciding(['DeclinePrivateTile'], {
            privateTrackLay: {
                privateCompanyId: PrivateId,
                companyId: TestCompanyId,
                playerId: TestPlayerId
            }
        })
        await lay.module.declinePrivateTile()
        expect(lay.applied[0]).toMatchObject({
            type: 'DeclinePrivateTile',
            privateCompanyId: PrivateId
        })

        await expect(deciding(['DeclinePrivateTile']).module.declinePrivateTile()).rejects.toThrow()
        await expect(
            deciding(['RespondToPurchaseOffer']).module.respondToPurchaseOffer(true)
        ).rejects.toThrow()
    })

    it('hides the staged decision while selections are hidden', () => {
        const { module } = deciding(['OfferPurchase'], {}, { selectionsVisible: false })
        module.selectPurchaseOffer(purchase)
        expect(module.selection).toBeUndefined()
        expect(module.choice.hasManual()).toBe(true)
    })
})
