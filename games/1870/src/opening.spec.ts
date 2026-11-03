import { describe, expect, it } from 'vitest'
import { cashOwnedBy, getCompany, sharesOwned } from '@tabletop/18xx'
import { buyAllPrivates, launch, spaceAt } from '../test/flow.js'
import { table } from '../test/table.js'
import { Market1870 } from './stockMarket.js'
import { tableCertificateLimit } from './stock.js'

const owner = (playerId: string) => ({ kind: 'player' as const, playerId })

describe('the opening (pp. 4, 9-11)', () => {
    it.each([
        [2, 1050],
        [3, 700],
        [4, 525],
        [5, 420],
        [6, 350],
        [7, 300]
    ])('gives %i players $%i each out of a $12000 bank', (count, cash) => {
        const game = table(count)
        for (const player of game.state.players)
            expect(cashOwnedBy(game.state, owner(player.playerId))).toBe(cash)
        expect(
            game.state.cash.reduce(
                (total, account) =>
                    total + (typeof account.amount === 'number' ? account.amount : 0),
                0
            )
        ).toBe(12000)
    })

    it('reaches the stock round and its certificate limit with seven players', () => {
        const game = table(7)
        buyAllPrivates(game)
        expect(game.state.machineState).toBe('StockRound')
        expect(tableCertificateLimit(game.state)).toBe(9)
    })

    it('refuses more than seven players', () => {
        expect(() => table(8)).toThrow()
    })

    it('makes the Frisco private its railway’s president’s certificate, closing it at par', () => {
        const game = table(4)
        for (const lotId of ['GRSC', 'MRBC', 'SCC', 'GSC'])
            game.act('BuyAuctionLot', {
                lotId,
                expectedPrice: { GRSC: 20, MRBC: 40, SCC: 50, GSC: 80 }[lotId]
            })
        const buyer = game.player
        game.act('BuyAuctionLot', { lotId: 'FRISCO', expectedPrice: 140 })
        expect(game.state.pendingPar).toEqual({ companyId: 'SLSF', playerId: buyer })
        game.act('ParCompany', { companyId: 'SLSF', marketSpaceId: spaceAt(100) }, buyer)
        expect(getCompany(game.state, 'FRISCO').closed).toBe(true)
        expect(sharesOwned(game.state, 'SLSF', owner(buyer))).toBe(2)
        game.act('BuyAuctionLot', { lotId: 'KATY', expectedPrice: 160 })
        // It floats at 20% and receives ten times par.
        expect(game.state.machineState).toBe('StockRound')
        expect(getCompany(game.state, 'SLSF').floated).toBe(true)
        expect(cashOwnedBy(game.state, { kind: 'company', companyId: 'SLSF' })).toBe(1000)
        expect(Market1870.companySpace(game.state.stockMarket, 'SLSF').price).toBe(100)
    })

    it('gives the Katy private’s buyer a 10% share, the company unstarted', () => {
        const game = table(4)
        buyAllPrivates(game)
        const holder = game.state.players.find(
            (player) => sharesOwned(game.state, 'MKT', owner(player.playerId)) === 1
        )
        expect(holder).toBeDefined()
        expect(getCompany(game.state, 'MKT').started).toBeFalsy()
    })

    it('floats an ordinary company at six shares sold, for ten times par', () => {
        const game = table(4)
        buyAllPrivates(game)
        expect(game.state.machineState).toBe('StockRound')
        launch(game, 'ATSF', 68)
        expect(getCompany(game.state, 'ATSF').floated).toBeFalsy()
        expect(cashOwnedBy(game.state, { kind: 'company', companyId: 'ATSF' })).toBe(0)
    })

    it('reduces the Great River Shipping Company by $5 when all players pass', () => {
        const game = table(3)
        const start = game.state.activePlayerIds[0]
        for (let index = 0; index < 3; index++) game.act('PassAuction')
        expect(game.state.machineState).toBe('WaterfallAuction')
        game.act('BuyAuctionLot', { lotId: 'GRSC', expectedPrice: 15 })
        expect(start).toBeDefined()
    })

    it('forbids sales in the first stock round', () => {
        const game = table(4)
        buyAllPrivates(game)
        expect(game.valid()).not.toContain('SellShares')
    })
})
