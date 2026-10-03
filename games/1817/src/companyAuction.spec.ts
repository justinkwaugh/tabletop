import { describe, expect, it } from 'vitest'
import {
    cashOwnedBy,
    companyMarketSpace,
    evaluateSharePurchase,
    evaluateShareSale,
    getCompany,
    privateOwner,
    type EighteenXXState
} from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import {
    EighteenSeventeenCompanyAuction,
    EighteenSeventeenStockRules,
    stationsOwed
} from './index.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'

const lansing = { locationId: 'B5', nodeId: 'city' }

function trading(prepare?: (state: EighteenXXState) => void) {
    const play = playExample(EighteenSeventeenScenarios, 'trading', 3, prepare)
    return Object.assign(play, {
        cash: (playerId: string) => cashOwnedBy(play.state, { kind: 'player', playerId }),
        treasury: (companyId: string) => cashOwnedBy(play.state, { kind: 'company', companyId })
    })
}

function giveCash(state: EighteenXXState, playerId: string, amount: number) {
    const cash = state.cash.find(
        (cash) => cash.owner.kind === 'player' && cash.owner.playerId === playerId
    )!
    cash.amount = amount
}

function givePrivate(state: EighteenXXState, privateId: string, playerId: string) {
    const certificate = state.certificates.find((item) => item.companyId === privateId)!
    if (!certificate.retired) certificate.owner = { kind: 'player', playerId }
}

describe('company auctions', () => {
    it('starts a 2-share company at half the winning bid with the bid in its treasury', () => {
        const play = trading()
        expect(play.state.activePlayerIds).toEqual(['alex'])
        expect(play.valid('alex')).toContain('AuctionCompany')
        play.act('AuctionCompany', { companyId: 'AS', amount: 100, home: lansing })
        expect(play.state.activePlayerIds).toEqual(['blair'])
        expect(play.valid('blair')).toEqual(
            expect.arrayContaining(['PassCompanyAuction', 'BidForCompany'])
        )
        expect(play.valid('alex')).not.toContain('PassCompanyAuction')
        play.act('PassCompanyAuction', { companyId: 'AS' })
        play.act('PassCompanyAuction', { companyId: 'AS' })
        expect(play.valid('alex')).toEqual(expect.arrayContaining(['FormCompany']))
        play.act('FormCompany', { companyId: 'AS', shareCount: 2, privateIds: [] })
        const company = getCompany(play.state, 'AS')
        expect(company).toMatchObject({ started: true, floated: true, shareCount: 2, parPrice: 50 })
        expect(company.president).toEqual({ kind: 'player', playerId: 'alex' })
        expect(companyMarketSpace(play.state.stockMarket, 'AS').price).toBe(50)
        expect(play.treasury('AS')).toBe(100)
        expect(play.cash('alex')).toBe(200)
        expect(play.state.stations.find((station) => station.id === 'AS:home')).toMatchObject({
            status: 'placed',
            position: { locationId: 'B5', nodeId: 'city' }
        })
        expect(play.state.activePlayerIds).toEqual(['blair'])
        expect(play.state.stockRound.passedPlayerIds).toEqual([])
    })

    it('lets another player outbid the opener and forms the winner’s company without a decision', () => {
        const play = trading()
        play.act('AuctionCompany', { companyId: 'AS', amount: 100, home: lansing })
        expect(() => play.act('BidForCompany', { companyId: 'AS', amount: 103 })).toThrow()
        play.act('BidForCompany', { companyId: 'AS', amount: 115 })
        play.act('PassCompanyAuction', { companyId: 'AS' })
        expect(play.state.activePlayerIds).toEqual(['alex'])
        play.act('PassCompanyAuction', { companyId: 'AS' })
        expect(getCompany(play.state, 'AS').president).toEqual({
            kind: 'player',
            playerId: 'blair'
        })
        expect(companyMarketSpace(play.state.stockMarket, 'AS').price).toBe(55)
        expect(play.treasury('AS')).toBe(115)
        expect(play.state.activePlayerIds).toEqual(['blair'])
    })

    it('forms a 5-share company in phase 3 and buys its extra station', () => {
        const play = trading((state) => {
            state.phaseId = '3'
            giveCash(state, 'blair', 300)
        })
        play.act('AuctionCompany', { companyId: 'AS', amount: 250, home: lansing })
        play.act('PassCompanyAuction', { companyId: 'AS' })
        play.act('PassCompanyAuction', { companyId: 'AS' })
        expect(() =>
            play.act('FormCompany', { companyId: 'AS', shareCount: 10, privateIds: [] })
        ).toThrow()
        play.act('FormCompany', { companyId: 'AS', shareCount: 5, privateIds: [] })
        expect(companyMarketSpace(play.state.stockMarket, 'AS').price).toBe(120)
        expect(play.treasury('AS')).toBe(200)
        expect(
            play.state.certificates
                .filter((item) => !item.retired && item.companyId === 'AS')
                .map((item) => item.id)
        ).toEqual(['AS:president', 'AS:share:1', 'AS:share:2', 'AS:share:3'])
        expect(play.state.stations.filter((station) => station.companyId === 'AS')).toHaveLength(2)
    })

    it('pays a bid partly with privates bought by the company at face value', () => {
        const play = trading((state) => {
            giveCash(state, 'alex', 200)
            givePrivate(state, 'MAJC', 'alex')
            givePrivate(state, 'OBC', 'alex')
            givePrivate(state, 'MINC', 'blair')
        })
        expect(EighteenSeventeenCompanyAuction.maximumBid(play.state, 'alex')).toBe(330)
        play.act('AuctionCompany', { companyId: 'AS', amount: 300, home: lansing })
        // Blair's $250 and $30 private cannot reach $305, so only Casey is asked.
        expect(play.state.activePlayerIds).toEqual(['casey'])
        play.act('PassCompanyAuction', { companyId: 'AS' })
        expect(() =>
            play.act('FormCompany', { companyId: 'AS', shareCount: 2, privateIds: ['MINC'] })
        ).toThrow()
        play.act('FormCompany', { companyId: 'AS', shareCount: 2, privateIds: ['MAJC', 'OBC'] })
        expect(privateOwner(play.state, 'MAJC')).toEqual({ kind: 'company', companyId: 'AS' })
        expect(privateOwner(play.state, 'OBC')).toEqual({ kind: 'company', companyId: 'AS' })
        expect(play.cash('alex')).toBe(30)
        expect(play.treasury('AS')).toBe(170)
    })

    it('accepts only bids its bidder can pay from cash and privates', () => {
        const play = trading((state) => {
            giveCash(state, 'alex', 50)
            givePrivate(state, 'MAJM', 'alex')
        })
        expect(EighteenSeventeenCompanyAuction.formable(play.state, 'alex', 160)).toBe(true)
        expect(EighteenSeventeenCompanyAuction.formable(play.state, 'alex', 110)).toBe(false)
        expect(() =>
            play.act('AuctionCompany', { companyId: 'AS', amount: 110, home: lansing })
        ).toThrow()
    })

    describe('stations owed at formation', () => {
        function formedShort() {
            const play = trading((state) => {
                state.phaseId = '6'
            })
            play.act('AuctionCompany', { companyId: 'AS', amount: 100, home: lansing })
            play.act('PassCompanyAuction', { companyId: 'AS' })
            play.act('PassCompanyAuction', { companyId: 'AS' })
            play.act('FormCompany', { companyId: 'AS', shareCount: 10, privateIds: [] })
            return play
        }
        const stations = (play: ReturnType<typeof trading>) =>
            play.state.stations.filter((station) => station.companyId === 'AS').length

        it('forms a company that cannot pay for its stations, which then owes them', () => {
            const play = formedShort()
            expect(getCompany(play.state, 'AS').shareCount).toBe(10)
            expect(play.treasury('AS')).toBe(100)
            expect(stations(play)).toBe(1)
            expect(stationsOwed(play.state, 'AS')).toBe(3)
        })

        it('buys its stations as soon as a treasury sale pays for them', () => {
            const play = formedShort()
            expect(play.state.activePlayerIds).toEqual(['blair'])
            play.act('BuyShares', {
                buyer: { kind: 'player', playerId: 'blair' },
                certificateId: 'AS:share:3',
                expectedPrice: 50
            })
            expect(stations(play)).toBe(4)
            expect(play.treasury('AS')).toBe(0)
            expect(stationsOwed(play.state, 'AS')).toBe(0)
        })

        it('liquidates a company still owing stations when the stock round ends', () => {
            const play = formedShort()
            while (play.state.machineState === 'StockRound') play.act('FinishStockTurn')
            expect(companyMarketSpace(play.state.stockMarket, 'AS').id).toBe(
                play.state.stockMarket.spaces.find((space) => space.column === 0)?.id
            )
            expect(play.state.operatingSet?.companyOrder).not.toContain('AS')
        })
    })

    it('forms without a decision when none of the winner’s privates fits the bid', () => {
        const play = trading((state) => {
            for (const cash of state.cash)
                if (cash.owner.kind === 'player' && cash.owner.playerId !== 'alex') cash.amount = 0
            givePrivate(state, 'MINC', 'blair')
            givePrivate(state, 'MAJM', 'alex')
        })
        play.act('AuctionCompany', { companyId: 'AS', amount: 100, home: lansing })
        expect(getCompany(play.state, 'AS').started).toBe(true)
        expect(privateOwner(play.state, 'MAJM')).toEqual({ kind: 'player', playerId: 'alex' })
    })

    it('refuses a home without an open slot', () => {
        const play = trading()
        expect(() =>
            play.act('AuctionCompany', {
                companyId: 'AS',
                amount: 100,
                home: { locationId: 'F13', nodeId: 'city' }
            })
        ).toThrow()
    })
})

describe('stock-round share rules', () => {
    it('buys a treasury share into the company at the market price', () => {
        const play = trading()
        const result = evaluateSharePurchase(
            play.state,
            {
                playerId: 'alex',
                buyer: { kind: 'player', playerId: 'alex' },
                certificateId: 'BA:share:3'
            },
            EighteenSeventeenStockRules
        )
        expect(result.details?.price).toBe(120)
        play.act('BuyShares', {
            buyer: { kind: 'player', playerId: 'alex' },
            certificateId: 'BA:share:3',
            expectedPrice: 120
        })
        expect(play.treasury('BA')).toBe(320)
    })

    it('sells without moving the price', () => {
        const play = trading()
        const request = {
            playerId: 'alex',
            seller: { kind: 'player', playerId: 'alex' } as const,
            sales: [{ companyId: 'BA', shares: 1 }]
        }
        const result = evaluateShareSale(play.state, request, EighteenSeventeenStockRules)
        expect(result.details?.proceeds).toBe(120)
        play.act('SellShares', { ...request, expectedProceeds: 120 })
        expect(companyMarketSpace(play.state.stockMarket, 'BA').price).toBe(120)
    })

    it('moves a company down one space per market share when the round ends', () => {
        const play = trading()
        for (const playerId of ['alex', 'blair', 'casey']) play.act('FinishStockTurn', {}, playerId)
        expect(play.state.stockRound.completed).toBe(true)
        expect(companyMarketSpace(play.state.stockMarket, 'BA').price).toBe(110)
        expect(companyMarketSpace(play.state.stockMarket, 'PLE').price).toBe(65)
    })
})
