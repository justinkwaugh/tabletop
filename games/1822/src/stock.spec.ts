import { describe, expect, it } from 'vitest'
import {
    evaluateShareSale,
    getCompany,
    placeStockMarker,
    stockCertificateCount,
    treasuryPoolId
} from '@tabletop/18xx'
import { kit, type Table } from '../test/kit.js'
import { cashOf, company, giveCharter, player, setCash, spaceAt } from '../test/positions.js'
import { LnwrId, concessionId } from './companies.js'
import { MarketPoolId1822 } from './names.js'
import type { State1822 } from './state.js'
import { BidBoxRules1822, CompanyRules1822, StockRules1822 } from './stock.js'
import { MajorParSpaceIds1822, Market1822 } from './stockMarket.js'

const parSpace = (price: number) => {
    const id = MajorParSpaceIds1822.find((spaceId) => Market1822.space(spaceId).price === price)
    if (!id) throw new Error(`No ${price} starting value`)
    return id
}

/** A table whose first stock round stands as prepared. */
function prepared(prepare: (state: State1822, players: string[]) => void, count = 4): Table {
    const game = kit.table(count, 3)
    const state = structuredClone(game.state)
    prepare(state, state.turnManager.turnOrder)
    game.state = state
    return game
}

function start(game: Table, companyId: string, price: number, expectedPrice: number) {
    return game.act('StartCompany', {
        buyer: player(game.player),
        companyId,
        marketSpaceId: parSpace(price),
        expectedPrice
    })
}

describe('converting a concession (§4.8)', () => {
    it('cannot be done in phase 1', () => {
        const game = prepared((state, [first]) =>
            giveCharter(state, concessionId('GWR'), player(first))
        )
        expect(CompanyRules1822.startMarketSpaces(game.hydrated, 'GWR')).toEqual([])
    })

    it('buys the director’s certificate for twice the value less £100, the bank adding the £100', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '2'
            giveCharter(state, concessionId('GWR'), player(first))
        })
        const first = game.player
        start(game, 'GWR', 80, 60)
        const state = game.state
        expect(cashOf(state, player(first))).toBe(525 - 60)
        expect(cashOf(state, company('GWR'))).toBe(160)
        expect(getCompany(state, 'GWR')).toMatchObject({ floated: true, parPrice: 80 })
        expect(getCompany(state, concessionId('GWR')).closed).toBe(true)
        expect(
            state.certificates.filter((entry) => entry.poolId === treasuryPoolId('GWR'))
        ).toHaveLength(8)
    })

    it('exchanges the LNWR’s concession for its 10% director’s certificate, the bank paying its value', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '2'
            giveCharter(state, concessionId(LnwrId), player(first))
        })
        const first = game.player
        start(game, LnwrId, 70, 0)
        expect(cashOf(game.state, player(first))).toBe(525)
        expect(cashOf(game.state, company(LnwrId))).toBe(70)
        expect(getCompany(game.state, LnwrId).floated).toBe(true)
    })

    it('is open only to the concession’s holder', () => {
        const game = prepared((state, [, second]) => {
            state.phaseId = '2'
            giveCharter(state, concessionId('GWR'), player(second))
        })
        const terms = CompanyRules1822.startTerms(
            game.hydrated,
            'GWR',
            player(game.player),
            parSpace(80)
        )
        expect(terms).toMatch(/holder/)
    })

    it('pays the company for shares bought from its treasury (§4.7.1)', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '2'
            giveCharter(state, concessionId('GWR'), player(first))
        })
        start(game, 'GWR', 80, 60)
        const buyer = game.player
        const share = game.state.certificates.find(
            (entry) => entry.poolId === treasuryPoolId('GWR') && entry.kind === 'share'
        )
        game.act('BuyShares', { buyer: player(buyer), certificateId: share?.id, expectedPrice: 80 })
        expect(cashOf(game.state, company('GWR'))).toBe(240)
    })
})

describe('starting a major from phase 5 (§3.4.4–§3.4.7)', () => {
    function soldTo(state: State1822, companyId: string, playerId: string, shares: number) {
        let left = shares
        for (const certificate of state.certificates) {
            if (left <= 0) break
            if (
                certificate.companyId !== companyId ||
                certificate.kind !== 'share' ||
                certificate.president ||
                certificate.poolId !== treasuryPoolId(companyId)
            )
                continue
            certificate.owner = player(playerId)
            delete certificate.poolId
            left -= certificate.shares
        }
    }

    it('sells the director’s certificate outright and floats the company at 50%, without further capital in phase 5', () => {
        const game = prepared((state) => {
            state.phaseId = '5'
        })
        const first = game.player
        start(game, 'MR', 90, 180)
        expect(getCompany(game.state, 'MR').floated).toBe(false)
        expect(cashOf(game.state, company('MR'))).toBe(180)
        const state = structuredClone(game.state)
        soldTo(state, 'MR', first, 2)
        game.state = state
        const buyer = game.player
        const share = game.state.certificates.find(
            (entry) => entry.poolId === treasuryPoolId('MR') && entry.kind === 'share'
        )
        game.act('BuyShares', { buyer: player(buyer), certificateId: share?.id, expectedPrice: 90 })
        expect(getCompany(game.state, 'MR').floated).toBe(true)
        expect(cashOf(game.state, company('MR'))).toBe(180 + 90)
        expect(
            game.state.certificates.filter((entry) => entry.poolId === treasuryPoolId('MR'))
        ).toHaveLength(5)
    })

    it('pays a company floated from phase 6 for its unsold half, which goes to the bank pool', () => {
        const game = prepared((state) => {
            state.phaseId = '6'
        })
        const first = game.player
        start(game, 'MR', 100, 200)
        const state = structuredClone(game.state)
        soldTo(state, 'MR', first, 2)
        game.state = state
        const buyer = game.player
        const share = game.state.certificates.find(
            (entry) => entry.poolId === treasuryPoolId('MR') && entry.kind === 'share'
        )
        game.act('BuyShares', {
            buyer: player(buyer),
            certificateId: share?.id,
            expectedPrice: 100
        })
        expect(getCompany(game.state, 'MR').floated).toBe(true)
        // Three shares' payments so far, and the bank's for the five unsold: ten times the value.
        expect(cashOf(game.state, company('MR'))).toBe(200 + 100 + 500)
        expect(
            game.state.certificates.filter(
                (entry) => entry.companyId === 'MR' && entry.poolId === MarketPoolId1822
            )
        ).toHaveLength(5)
    })
})

describe('trading shares (§4.6, §4.7)', () => {
    it('sells no share of a company that has not completed an operating round', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '3'
            kit.operated(state, 'CR', first, { price: 100, shares: 4 })
            getCompany(state, 'CR').operated = false
        })
        const sale = evaluateShareSale(
            game.hydrated,
            {
                playerId: game.player,
                seller: player(game.player),
                sales: [{ companyId: 'CR', shares: 1 }]
            },
            StockRules1822
        )
        expect(sale.reason).toMatch(/operating round/)
    })

    it('drops the value a space for each share sold and pays the value before the sale (§4.6.3)', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '3'
            kit.operated(state, 'CR', first, { price: 100, shares: 5 })
        })
        const seller = game.player
        game.act('SellShares', {
            seller: player(seller),
            sales: [{ companyId: 'CR', shares: 2 }],
            expectedProceeds: 200
        })
        expect(Market1822.companySpace(game.state.stockMarket, 'CR').price).toBe(80)
        expect(cashOf(game.state, player(seller))).toBe(525 + 200)
    })

    it('does not count certificates of companies in the yellow zone, and counts highest bids (§4.4.2, §4.9.4)', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '3'
            kit.operated(state, 'CR', first, { price: 60, shares: 4 })
            placeStockMarker(state.stockMarket, 'CR', spaceAt(45, 6))
            state.bidBoxes.bids = [
                { lotId: state.bidBoxes.boxes[0].lotId, playerId: first, amount: 100 }
            ]
        })
        const state = game.hydrated
        const first = game.player
        expect(stockCertificateCount(state, player(first), StockRules1822)).toBe(0)
        expect(StockRules1822.certificateLimit(state, player(first))).toBe(20 - 1)
    })

    it('bars a player with a loan from bidding and buying (§4.2.1)', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '3'
            state.playerLoans = [{ playerId: first, amount: 90 }]
            kit.operated(state, 'CR', first, { price: 100, shares: 4 })
            setCash(state, player(first), 300)
        })
        const state = game.hydrated
        const first = game.player
        const lotId = state.bidBoxes.boxes[0].lotId
        expect(BidBoxRules1822.restriction?.(state, first, lotId)).toMatch(/loan/)
        const share = state.certificates.find(
            (entry) => entry.poolId === treasuryPoolId('CR') && entry.kind === 'share'
        )
        if (share?.kind !== 'share') throw new Error('No treasury share')
        expect(StockRules1822.purchaseTerms(state, share, player(first))).toMatch(/loan/)
    })

    it('lets a player repay as much of a loan as they choose in their stock turn (§4.1.3)', () => {
        const game = prepared((state, [first]) => {
            state.phaseId = '3'
            state.playerLoans = [{ playerId: first, amount: 90 }]
            setCash(state, player(first), 300)
        })
        const first = game.player
        expect(game.valid(first)).toContain('RepayPlayerLoan')
        expect(() => game.act('RepayPlayerLoan', { amount: 91 }, first)).toThrow()
        game.act('RepayPlayerLoan', { amount: 50 }, first)
        expect(game.state.playerLoans).toEqual([{ playerId: first, amount: 40 }])
        expect(cashOf(game.state, player(first))).toBe(250)
        game.act('RepayPlayerLoan', { amount: 40 }, first)
        expect(game.state.playerLoans).toEqual([])
        expect(cashOf(game.state, player(first))).toBe(210)
    })
})
