import { describe, expect, it } from 'vitest'
import {
    evaluateSharePurchase,
    evaluateShareSale,
    getCompany,
    inReceivership,
    presidentCertificate
} from '@tabletop/18xx'
import { buyablePrivates, sellablePrivates } from './bankPrivates.js'
import { reservedShareId, CompanyRules1860, StockRules1860, openLayer } from './stock.js'
import { Market1860 } from './stockMarket.js'
import { edit, kit } from '../test/kit.js'
import { companyCash, openedWith, playerCash, running, seated } from '../test/positions.js'

const p = (playerId: string) => ({ kind: 'player' as const, playerId })

/** The opening with p2 holding the C&N and p3 the IOW, both at 74, in the first stock round. */
function firstStockRound() {
    return openedWith(seated(3))
}

function buy(game: ReturnType<typeof firstStockRound>, playerId: string, certificateId: string) {
    const terms = evaluateSharePurchase(
        game.state,
        { playerId, buyer: p(playerId), certificateId },
        StockRules1860
    )
    if (!terms.details) throw new Error(terms.reason)
    game.act(
        'BuyShares',
        { buyer: p(playerId), certificateId, expectedPrice: terms.details.price },
        playerId
    )
}

describe('companies and layers', () => {
    it('opens the second layer once a first-layer company has operated (LY-2)', () => {
        const game = firstStockRound()
        expect(openLayer(game.state)).toBe(1)
        expect(CompanyRules1860.startMarketSpaces(game.state, 'IWNJ')).toEqual([])
        edit(game, (state) => {
            getCompany(state, 'CN').operated = true
        })
        expect(openLayer(game.state)).toBe(2)
        expect(
            CompanyRules1860.startMarketSpaces(game.state, 'FYN').map(
                (id) => Market1860.space(id).price
            )
        ).toEqual([62, 68, 74, 82])
    })

    it('keeps the reserved share out of sale until its private closes (PV-9)', () => {
        const game = firstStockRound()
        const reserved = reservedShareId('CN')
        expect(reserved).toBeDefined()
        const terms = evaluateSharePurchase(
            game.state,
            { playerId: 'p1', buyer: p('p1'), certificateId: reserved ?? '' },
            StockRules1860
        )
        expect(terms.reason).toMatch(/exchange/)
    })

    it('exchanges a private for its reserved share as no stock action (PV-5)', () => {
        const game = firstStockRound()
        // p3 bought the Cowes Marina in the third auction.
        edit(game, (state) => kit.turnFor(state, 'p3'))
        game.act(
            'ExchangePrivate',
            { privateCompanyId: 'CMH', certificateId: reservedShareId('CN') },
            'p3'
        )
        expect(getCompany(game.state, 'CMH').closed).toBe(true)
        expect(game.state.stockRound.turn.bought).toBe(false)
        expect(game.state.certificates.find((c) => c.id === reservedShareId('CN'))?.owner).toEqual(
            p('p3')
        )
    })

    it('floats at half the shares in players’ hands, with ten times its par and its home tile', () => {
        const game = firstStockRound()
        // p2 holds the C&N director’s share; three more shares float it.
        for (const share of [1, 2, 3]) {
            edit(game, (state) => {
                kit.turnFor(state, 'p2')
                state.stockRound.turn = {
                    acted: false,
                    bought: false,
                    soldBeforeBuying: false,
                    companiesSold: []
                }
            })
            buy(game, 'p2', `CN:share:${share}`)
        }
        expect(getCompany(game.state, 'CN').floated).toBe(true)
        expect(companyCash(game.state, 'CN')).toBe(740)
        expect(game.state.stations.find((s) => s.id === 'CN:home')?.status).toBe('placed')
        // Cowes has no track, so the director lays its tile as the company floats (TR-10).
        expect(game.state.machineState).toBe('LayingHomeTile')
        expect(game.valid('p2')).toContain('LayHomeTile')
    })
})

describe('selling shares', () => {
    it('sells a company without a train at half price, unmoved before it operates (SR-6, SR-7)', () => {
        const game = firstStockRound()
        edit(game, (state) => {
            kit.turnFor(state, 'p2')
            const share = state.certificates.find((c) => c.id === 'CN:share:1')
            if (share) {
                share.owner = p('p2')
                delete share.poolId
            }
        })
        const sale = evaluateShareSale(
            game.state,
            { playerId: 'p2', seller: p('p2'), sales: [{ companyId: 'CN', shares: 1 }] },
            StockRules1860
        )
        expect(sale.reason).toBeUndefined()
        expect(sale.details?.proceeds).toBe(37)
    })

    it('moves an operated company one place a share, the first free in the red zone (SR-4)', () => {
        const game = firstStockRound()
        edit(game, (state) => {
            running(state, 'NGStL', 'p1', { price: 166, shares: 6 })
            kit.giveTrain(state, 'NGStL', '2+1')
            kit.turnFor(state, 'p1')
        })
        game.act(
            'SellShares',
            {
                seller: p('p1'),
                sales: [{ companyId: 'NGStL', shares: 3 }],
                expectedProceeds: 3 * 166
            },
            'p1'
        )
        expect(Market1860.companySpace(game.state.stockMarket, 'NGStL').price).toBe(150)
    })

    it('puts the company in receivership when its director’s share goes to the pool (SR-11, SR-12)', () => {
        const game = firstStockRound()
        edit(game, (state) => {
            running(state, 'NGStL', 'p1', { price: 62, shares: 2 })
            kit.giveTrain(state, 'NGStL', '2+1')
            for (const id of ['NGStL:share:1', 'NGStL:share:2'])
                Object.assign(state.certificates.find((c) => c.id === id) ?? {}, {
                    owner: { kind: 'bank' },
                    poolId: 'open-market'
                })
            const single = state.certificates.find((c) => c.id === 'NGStL:share:3')
            if (single) {
                single.owner = p('p2')
                delete single.poolId
            }
            kit.turnFor(state, 'p1')
        })
        game.act(
            'SellShares',
            {
                seller: p('p1'),
                sales: [{ companyId: 'NGStL', shares: 2 }],
                expectedProceeds: 2 * 62
            },
            'p1'
        )
        expect(inReceivership(game.state, 'NGStL')).toBe(true)
        // The first player to hold two shares takes the director’s share from the pool.
        edit(game, (state) => kit.turnFor(state, 'p2'))
        buy(game, 'p2', 'NGStL:share:1')
        expect(presidentCertificate(game.state, 'NGStL')?.owner).toEqual(p('p2'))
        expect(inReceivership(game.state, 'NGStL')).toBe(false)
    })
})

describe('privates and the bank', () => {
    it('buys privates back from the bank only after the first stock round (PV-2, SR-13)', () => {
        const game = firstStockRound()
        expect(sellablePrivates(game.state, 'p1')).toEqual([])
        edit(game, (state) => {
            state.stockRound.number = 2
        })
        expect(sellablePrivates(game.state, 'p1')).toEqual(['BHC', 'RPSC'])
        game.act('SellPrivateToBank', { privateCompanyId: 'RPSC' }, 'p1')
        expect(playerCash(game.state, 'p1')).toBe(670 - 160 + 100)
        expect(buyablePrivates(game.state, 'p1')).toEqual([])
        edit(game, (state) => kit.turnFor(state, 'p2'))
        expect(buyablePrivates(game.state, 'p2')).toEqual(['RPSC'])
    })

    it('offers the Fishbourne Ferry from phase 6, closing the other privates (PV-3, PV-4)', () => {
        const game = firstStockRound()
        expect(buyablePrivates(game.state, 'p1')).not.toContain('FFC')
        edit(game, (state) => {
            state.phaseId = '6'
        })
        expect(buyablePrivates(game.state, 'p1')).toContain('FFC')
        game.act('BuyPrivateFromBank', { privateCompanyId: 'FFC' }, 'p1')
        for (const id of ['BHC', 'YHC', 'CMH', 'RPSC'])
            expect(getCompany(game.state, id).closed).toBe(true)
        // The purchase is the turn's buy, which ends it.
        expect(game.state.activePlayerIds).toEqual(['p2'])
        // The reserved shares are now for sale (PV-9).
        expect(
            evaluateSharePurchase(
                game.state,
                { playerId: 'p2', buyer: p('p2'), certificateId: reservedShareId('IOW') ?? '' },
                StockRules1860
            ).details?.price
        ).toBe(74)
    })
})
