import { describe, expect, it } from 'vitest'
import {
    minimalPlayState,
    minimalStockRules,
    TestCompanyId,
    TestPlayerId
} from '@tabletop/18xx/testing'
import type { CompanyAuctionRules, SelectionAuctionRules } from '@tabletop/18xx'
import { SelectionAuctionModule } from './selectionAuctionModule.svelte.js'
import { CompanyAuctionModule } from './companyAuctionModule.svelte.js'
import { testSession } from './moduleTestSession.js'

const selectionRules: SelectionAuctionRules = {
    lots: () => [{ id: 'P', name: 'Private', price: 40 }],
    nominationLotIds: () => ['P'],
    passingWhileNominating: () => true,
    openingBid: () => 10,
    increment: 5,
    award: () => {},
    closeUnsold: () => {}
}

function selection(valid: string[], passingWhileNominating = () => true) {
    const state = {
        ...minimalPlayState(),
        cash: [
            { owner: { kind: 'bank' as const }, amount: 'unlimited' as const },
            { owner: { kind: 'player' as const, playerId: TestPlayerId }, amount: 100 }
        ],
        machineState: 'SelectionAuction',
        selectionAuction: {
            remainingLotIds: ['P'],
            nominatorId: TestPlayerId,
            passedPlayerIds: [],
            awards: [],
            closedLotIds: [],
            completed: false
        }
    }
    const harness = testSession(
        state,
        { selectionAuctionRules: { ...selectionRules, passingWhileNominating } },
        valid
    )
    return { ...harness, module: new SelectionAuctionModule(harness.session) }
}

const home = { locationId: 'A1', nodeId: 'city', slot: 0 }
const auctionTerms: CompanyAuctionRules = {
    openingBid: 100,
    increment: 5,
    maximumBid: () => 200,
    formable: () => true,
    homes: () => [home],
    startSpace: () => '0:0',
    shareCounts: () => [2, 5],
    contributions: () => [],
    formationReason: () => undefined,
    form: () => {}
}

function companyAuction(valid: string[]) {
    const state = minimalPlayState()
    state.companies[0].started = false
    const harness = testSession(
        state,
        { stockRules: { ...minimalStockRules, companyAuction: auctionTerms } },
        valid
    )
    return { ...harness, module: new CompanyAuctionModule(harness.session) }
}

describe('SelectionAuctionModule', () => {
    it('stages a nomination at the opening bid and applies it', async () => {
        const { module, applied } = selection(['PassSelectionAuction', 'NominateLot'])
        expect(module.active).toBe(true)
        module.select('P')
        expect(module.selection).toEqual({ lotId: 'P', amount: 10 })
        module.setBid(20)
        await module.nominate()
        expect(applied).toMatchObject([{ type: 'NominateLot', lotId: 'P', amount: 20 }])
    })

    it('nominates when the title forbids passing', async () => {
        const { module, applied } = selection(['NominateLot'], () => false)
        expect(module.canPass).toBe(false)
        expect(module.passOffered).toBe(false)
        module.select('P')
        await module.nominate()
        expect(applied).toMatchObject([{ type: 'NominateLot', lotId: 'P', amount: 10 }])
    })

    it('passes as one action and drops a staged nomination', async () => {
        const { module, applied } = selection(['PassSelectionAuction'])
        module.select('P')
        await module.pass()
        expect(applied).toMatchObject([{ type: 'PassSelectionAuction' }])
        expect(module.choice.hasManual()).toBe(false)
    })
})

describe('CompanyAuctionModule', () => {
    it('offers home cities once a company is chosen and opens at the opening bid', async () => {
        const { module, applied } = companyAuction(['AuctionCompany'])
        expect(module.companies.map((company) => company.id)).toEqual([TestCompanyId])
        expect(module.homeLocationIds).toEqual([])
        module.selectCompany(TestCompanyId)
        expect(module.homeLocationIds).toEqual(['A1'])
        module.chooseHome({ locationId: 'A1', nodeId: 'city' })
        expect(module.openingAmount).toBe(100)
        expect(module.homeLocationIds).toEqual([])
        module.setOpeningBid(120)
        await module.open()
        expect(applied).toMatchObject([
            {
                type: 'AuctionCompany',
                companyId: TestCompanyId,
                amount: 120,
                home: { locationId: 'A1', nodeId: 'city' }
            }
        ])
    })

    it('undoes the opening stages one at a time, skipping the automatic bid', () => {
        const { module } = companyAuction(['AuctionCompany'])
        module.selectCompany(TestCompanyId)
        module.chooseHome({ locationId: 'A1', nodeId: 'city' })
        expect(module.undo()).toBe(true)
        expect(module.selectedHome).toBeUndefined()
        expect(module.selectedCompanyId).toBe(TestCompanyId)
        expect(module.undo()).toBe(true)
        expect(module.selectedCompanyId).toBeUndefined()
        expect(module.undo()).toBe(false)
    })
})
