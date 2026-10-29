import { describe, expect, it } from 'vitest'
import { cashOwnedBy, privateOwner } from '@tabletop/18xx'
import { table } from '../test/table.js'
import { StockRules1833NE } from './stock.js'

describe('1833NE opening', () => {
    it.each([
        [3, 600, 24],
        [4, 450, 18],
        [5, 400, 14]
    ])('gives %i players $%i each and a certificate limit of %i', (count, cash, limit) => {
        const game = table(count)
        expect(game.state.machineState).toBe('WaterfallAuction')
        for (const player of game.state.players)
            expect(cashOwnedBy(game.state, { kind: 'player', playerId: player.playerId })).toBe(
                cash
            )
        const total = game.state.cash.reduce(
            (sum, account) => sum + (typeof account.amount === 'number' ? account.amount : 0),
            0
        )
        expect(total).toBe(10000)
        expect(StockRules1833NE.certificateLimit(game.state)).toBe(limit)
    })

    it('takes a first bid at the printed price in $5 steps, and later bids beat it by $5', () => {
        const game = table()
        expect(() => game.act('ReserveBid', { lotId: 'P2', amount: 42 })).toThrow()
        game.act('ReserveBid', { lotId: 'P2', amount: 40 })
        expect(() => game.act('ReserveBid', { lotId: 'P2', amount: 40 })).toThrow()
        game.act('ReserveBid', { lotId: 'P2', amount: 45 })
        expect(game.state.openingAuction?.reservations).toHaveLength(2)
    })

    it('resolves pending bids and pays two income rounds when everyone passes', () => {
        const game = table()
        const cash = (playerId: string) => {
            const amount = cashOwnedBy(game.state, { kind: 'player', playerId })
            return typeof amount === 'number' ? amount : 0
        }
        const buyer = game.player
        game.act('BuyAuctionLot', { lotId: 'P1', expectedPrice: 15 })
        const bidder = game.player
        game.act('ReserveBid', { lotId: 'P3', amount: 50 })
        const before = { buyer: cash(buyer), bidder: cash(bidder) }
        for (let pass = 0; pass < 4; pass++) game.act('PassAuction')
        expect(privateOwner(game.state, 'P3')).toEqual({ kind: 'player', playerId: bidder })
        expect(privateOwner(game.state, 'P2')).toEqual({ kind: 'bank' })
        expect(game.state.machineState).toBe('WaterfallAuction')
        expect(cash(buyer)).toBe(before.buyer + 10)
        expect(cash(bidder)).toBe(before.bidder - 50 + 20)
    })
})
