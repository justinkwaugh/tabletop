import { describe, expect, it } from 'vitest'
import { AuctionType } from '@tabletop/common'
import {
    minimalPlayState,
    minimalStockRules,
    TestCompanyId,
    TestPlayerId
} from '@tabletop/18xx/testing'
import type {
    CompanyAuctionRules,
    CompanyAuctionState,
    SelectionAuctionRules
} from '@tabletop/18xx'
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
const otherHome = { locationId: 'B2', nodeId: 'city', slot: 0 }
const auctionTerms: CompanyAuctionRules = {
    openingBid: 100,
    increment: 5,
    maximumBid: () => 200,
    formable: () => true,
    homes: () => [home, otherHome],
    startSpace: () => '0:0',
    shareCounts: () => [2, 5],
    contributions: () => [],
    contributionValue: (privateIds) => privateIds.length * 40,
    formationReason: () => undefined,
    form: () => {}
}

function companyAuction(
    valid: string[],
    terms: CompanyAuctionRules = auctionTerms,
    standingAuction?: CompanyAuctionState['companyAuction']
) {
    const state = {
        ...minimalPlayState(),
        ...(standingAuction ? { companyAuction: standingAuction } : {})
    }
    state.companies[0].started = false
    const harness = testSession(
        state,
        { stockRules: { ...minimalStockRules, companyAuction: terms } },
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
    function wonAuction(
        valid: string[],
        formationReason: CompanyAuctionRules['formationReason'] = auctionTerms.formationReason
    ) {
        return companyAuction(
            valid,
            { ...auctionTerms, contributions: () => ['P', 'Q'], formationReason },
            {
                companyId: TestCompanyId,
                openerId: TestPlayerId,
                home,
                auction: {
                    id: 'auction',
                    type: AuctionType.Simple,
                    auctioneerId: TestPlayerId,
                    highBid: 120,
                    participants: [{ playerId: TestPlayerId, passed: false, bid: 120 }]
                }
            }
        )
    }

    it('splits the winning bid between cash and the privates chosen so far', () => {
        const { module } = wonAuction(['FormCompany'])
        expect(module.formationPayment).toEqual({ privatesValue: 0, cash: 120 })
        module.toggleContribution('P')
        expect(module.formationPayment).toEqual({ privatesValue: 40, cash: 80 })
        module.toggleContribution('Q')
        expect(module.formationPayment).toEqual({ privatesValue: 80, cash: 40 })
        module.toggleContribution('P')
        expect(module.formationPayment).toEqual({ privatesValue: 40, cash: 80 })
    })

    it('names a payment problem before asking for a size', () => {
        const { module } = wonAuction(['FormCompany'], (_state, formation) =>
            formation.privateIds.length ? undefined : 'Contribute more.'
        )
        expect(module.formationProblem).toBe('Contribute more.')
        module.toggleContribution('P')
        expect(module.formationProblem).toBe('Choose a size.')
        module.setShareCount(2)
        expect(module.formationProblem).toBeUndefined()
    })

    it('leaves the split to the winner forming the company', () => {
        expect(wonAuction([]).module.formationPayment).toBeUndefined()
    })

    it('offers home cities once a company is chosen and opens at the opening bid', async () => {
        const { module, applied } = companyAuction(['AuctionCompany'])
        expect(module.companies.map((company) => company.id)).toEqual([TestCompanyId])
        expect(module.homeLocationIds).toEqual([])
        module.selectCompany(TestCompanyId)
        expect(module.homeLocationIds).toEqual(['A1', 'B2'])
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
        expect(module.chosenHome).toBeUndefined()
        module.chooseHome({ locationId: 'A1', nodeId: 'city' })
        expect(module.chosenHome).toEqual({
            companyId: TestCompanyId,
            locationId: 'A1',
            nodeId: 'city'
        })
        expect(module.undo()).toBe(true)
        expect(module.selectedHome).toBeUndefined()
        expect(module.chosenHome).toBeUndefined()
        expect(module.selectedCompanyId).toBe(TestCompanyId)
        expect(module.undo()).toBe(true)
        expect(module.selectedCompanyId).toBeUndefined()
        expect(module.undo()).toBe(false)
    })

    it('takes a company’s only home without a choice, Undo dropping the company', () => {
        const { module } = companyAuction(['AuctionCompany'], {
            ...auctionTerms,
            homes: () => [home]
        })
        module.selectCompany(TestCompanyId)
        expect(module.selectedHome).toEqual({ locationId: 'A1', nodeId: 'city' })
        expect(module.openingAmount).toBe(100)
        expect(module.undo()).toBe(true)
        expect(module.selectedCompanyId).toBeUndefined()
    })
})
