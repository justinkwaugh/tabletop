import { describe, expect, it } from 'vitest'
import { companyCharters } from '../company/companyCharters.js'
import type { LoanRules, LoanState } from '../loans/loans.js'
import { canRepayLoan } from '../loans/repayLoan.js'
import { createRectangularStockMarketSpaces, StockMarketChart } from '../stock/stockMarket.js'
import {
    minimalPlayState,
    minimalTrainRules,
    TestCompanyId,
    TestPlayerId
} from '../testing/index.js'
import { CompanyConversions } from './companyConversions.js'
import { CompanySales } from './companySales.js'
import { SizedCompanyAuction } from './sizedCompanyAuction.js'
import { SizedCompanyMarket } from './sizedCompanyMarket.js'
import { SizedCompanyStations } from './sizedCompanyStations.js'

// A one-row market: liquidation, three acquisition spaces, then $40 to $300.
const Prices = [0, 0, 0, 0, 40, 45, 50, 55, 60, 70, 80, 90, 100, 150, 200, 250, 300]
const Chart = new StockMarketChart(
    createRectangularStockMarketSpaces([Prices], (_row, column) =>
        column === 0 ? 'red' : column < 4 ? 'grey' : 'white'
    ).map((space) => ({
        ...space,
        moves: {
            ...(space.moves.right ? { right: space.moves.right } : {}),
            ...(space.moves.left && space.column > 1 ? { left: space.moves.left } : {})
        }
    }))
)
const Market = new SizedCompanyMarket({
    market: Chart,
    charters: companyCharters(() => ({ shareCounts: { [TestCompanyId]: 2 }, privateRevenues: {} })),
    marketPoolId: 'market',
    charterShareCount: 2,
    isLiquidationSpace: (space) => space.color === 'red',
    isAcquisitionSpace: (space) => space.color === 'grey'
})
const Stations = new SizedCompanyStations(Market, {
    bySize: { 2: 1, 5: 2, 10: 4 },
    price: 50,
    limit: 8
})

function auction(startPrices?: { minimum: number; maximum: number }) {
    return new SizedCompanyAuction({
        market: Market,
        stations: Stations,
        openingBid: 100,
        increment: 1,
        ...(startPrices ? { startPrices } : {}),
        privateFaceValue: () => 0,
        shareCounts: () => [2, 5],
        homes: () => [],
        atCertificateLimit: () => false
    })
}

const price = (spaceId: string) => Chart.space(spaceId).price

describe('the start space', () => {
    it('is the highest priced space at or below half the bid', () => {
        expect(price(auction().startSpace(minimalPlayState(), 175))).toBe(80)
        expect(price(auction().startSpace(minimalPlayState(), 600))).toBe(300)
    })

    it('stays within a title’s start prices, as 18USA’s $50 to $200', () => {
        const usa = auction({ minimum: 50, maximum: 200 })
        expect(price(usa.startSpace(minimalPlayState(), 100))).toBe(50)
        expect(price(usa.startSpace(minimalPlayState(), 90))).toBe(50)
        expect(price(usa.startSpace(minimalPlayState(), 600))).toBe(200)
    })
})

describe('stations a conversion adds', () => {
    const held = (count: number) => {
        const state = minimalPlayState()
        state.stations = Array.from({ length: count }, (_, index) => ({
            id: `station:${index}`,
            companyId: TestCompanyId,
            status: 'available' as const
        }))
        return state
    }

    it('are the next size’s stations beyond the last size’s, up to the limit', () => {
        expect(Stations.stationsForGrowth(held(1), TestCompanyId, 2, 5)).toBe(1)
        expect(Stations.stationsForGrowth(held(2), TestCompanyId, 5, 10)).toBe(2)
        expect(Stations.stationsForGrowth(held(7), TestCompanyId, 5, 10)).toBe(1)
        expect(Stations.stationsForGrowth(held(8), TestCompanyId, 2, 5)).toBe(0)
    })
})

function borrowingState(): LoanState {
    const state = minimalPlayState()
    state.companies = [{ id: TestCompanyId, kind: 'major', started: true, floated: true, loans: 2 }]
    state.cash = [
        { owner: { kind: 'bank' }, amount: 'unlimited' },
        { owner: { kind: 'company', companyId: TestCompanyId }, amount: 300 }
    ]
    state.certificates = [
        {
            id: 'president',
            companyId: TestCompanyId,
            kind: 'share',
            shares: 2,
            president: true,
            owner: { kind: 'player', playerId: TestPlayerId }
        }
    ]
    Chart.placeMarker(state.stockMarket, TestCompanyId, '0:10')
    return { ...state, loanStep: { companyId: TestCompanyId } }
}

const Loans: LoanRules = {
    market: Chart,
    value: 100,
    supply: 70,
    capacity: () => 5,
    rate: () => 5,
    takeMove: { direction: 'left', steps: 2 },
    repayMove: { direction: 'right', steps: 2 },
    interestDefault: () => ({ payments: [], marketMoves: [], unpaid: 0 })
}

describe('repaying in a turn the company borrowed', () => {
    it('is allowed unless the title forbids it, as 18USA does (§12.9)', () => {
        const state = { ...borrowingState(), turnLoans: { companyId: TestCompanyId, loans: 1 } }
        expect(canRepayLoan(state, Loans, TestPlayerId, TestCompanyId)).toBe(true)
        expect(
            canRepayLoan(
                state,
                { ...Loans, noRepaymentAfterBorrowing: true },
                TestPlayerId,
                TestCompanyId
            )
        ).toBe(false)
        expect(
            canRepayLoan(
                borrowingState(),
                { ...Loans, noRepaymentAfterBorrowing: true },
                TestPlayerId,
                TestCompanyId
            )
        ).toBe(true)
    })
})

describe('inherited loans the buyer keeps', () => {
    it('move its price as taking a loan does, two steps each with 18USA’s loans', () => {
        const conversions = new CompanyConversions({
            market: Market,
            stations: Stations,
            trainRules: minimalTrainRules,
            conversions: { 2: 5, 5: 10 },
            mergerPresidencyPercent: 40
        })
        const sales = new CompanySales({
            market: Market,
            conversions,
            loanRules: Loans,
            trainRules: minimalTrainRules,
            increment: 10
        })
        const state = { ...borrowingState(), mergerRound: undefined, acquisitionRound: undefined }
        const moves = sales.moveBuyerForUnpaidLoans(state, {
            sale: { companyId: 'sold', kind: 'acquisition' },
            buyerId: TestCompanyId,
            price: 10,
            inheritedLoans: 2,
            repaidLoans: 1
        })
        expect(moves.map((move) => price(move.toMarketSpaceId))).toEqual([60])
    })
})
