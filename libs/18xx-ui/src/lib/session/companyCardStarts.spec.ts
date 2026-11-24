import { describe, expect, it } from 'vitest'
import type { Owner } from '@tabletop/18xx'
import { TestCompanyId, TestPlayerId, minimalPlayState } from '@tabletop/18xx/testing'
import { CompanyCardStarts } from './companyCardStarts.js'
import { CompanyStartStageOrder, type CompanyStartStages } from './companyStartSelection.js'
import { StagedSelection } from './stagedSelection.svelte.js'
import type { StockAction } from '../stock/stockActionSelection.js'

const player = { kind: 'player', playerId: TestPlayerId } as const
const bank = { kind: 'company', companyId: 'UB' } as const

function cardStarts(offers: { buyers?: Owner[]; auction?: boolean; menu?: StockAction }) {
    const start = new StagedSelection<CompanyStartStages>(CompanyStartStageOrder, 'pop-stage')
    let auctionCompanyId: string | undefined
    let openMenu = offers.menu
    const stock = {
        start,
        get openMenu() {
            return openMenu
        },
        chooseMenu: (menu: StockAction | undefined) => {
            openMenu = menu
            start.clear()
        },
        get selectedStartCompany() {
            return start.value('company')
        },
        awaitingStartHome: false,
        availableMenus: offers.auction ? [{ menu: 'auction' as const }] : [],
        cardStarts: (companyId: string) =>
            companyId === TestCompanyId
                ? (offers.buyers ?? []).map((buyer) => ({
                      request: { playerId: TestPlayerId, buyer, companyId },
                      prices: []
                  }))
                : [],
        selectCompanyStart: (request: CompanyStartStages['company']) => {
            start.clear()
            start.choose('company', request)
        },
        chooseStartBuyer: (request: CompanyStartStages['company']) => {
            start.choose('company', request)
        }
    }
    const auction = {
        companies: [minimalPlayState().companies[0]],
        get selectedCompanyId() {
            return auctionCompanyId
        },
        selectCompany: (companyId: string) => (auctionCompanyId = companyId),
        clearOpening: () => (auctionCompanyId = undefined),
        homePositions: []
    }
    return { starts: new CompanyCardStarts(stock, auction), stock }
}

describe('CompanyCardStarts', () => {
    it('stages a start by the player first, switches its buyer, and closes it', () => {
        const { starts, stock } = cardStarts({ buyers: [bank, player], auction: true })
        expect(starts.kind(TestCompanyId)).toBe('start')
        expect(starts.buyers(TestCompanyId)).toEqual([player, bank])
        starts.open(TestCompanyId)
        expect(starts.selected(TestCompanyId)).toBe(true)
        expect(stock.selectedStartCompany?.buyer).toEqual(player)
        starts.chooseBuyer(TestCompanyId, bank)
        expect(stock.selectedStartCompany?.buyer).toEqual(bank)
        starts.close(TestCompanyId)
        expect(starts.selected(TestCompanyId)).toBe(false)
    })

    it('stages an auction opening, dropping a staged start, and closes it', () => {
        const { starts, stock } = cardStarts({ auction: true })
        stock.selectCompanyStart({ playerId: TestPlayerId, buyer: player, companyId: 'other' })
        expect(starts.kind(TestCompanyId)).toBe('auction')
        starts.open(TestCompanyId)
        expect(stock.selectedStartCompany).toBeUndefined()
        expect(starts.selected(TestCompanyId)).toBe(true)
        starts.close(TestCompanyId)
        expect(starts.selected(TestCompanyId)).toBe(false)
    })

    it('closes an open Start menu, which would show the same start again', () => {
        const { starts, stock } = cardStarts({ buyers: [player], menu: 'start' })
        starts.open(TestCompanyId)
        expect(stock.openMenu).toBeUndefined()
        expect(starts.stagedCompanyId).toBe(TestCompanyId)
    })

    it('offers nothing while the stock round has no auction menu', () => {
        const { starts } = cardStarts({})
        expect(starts.kind(TestCompanyId)).toBeUndefined()
        expect(() => starts.open(TestCompanyId)).toThrow()
    })
})
