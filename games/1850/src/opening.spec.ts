import { describe, expect, it } from 'vitest'
import { cashOwnedBy, sharesOwned } from '@tabletop/18xx'
import { buyAllPrivates, launch, table } from '../test/kit.js'
import { tableCertificateLimit } from './stock.js'

const owner = (playerId: string) => ({ kind: 'player' as const, playerId })

describe('the opening (§3.3, §5.7)', () => {
    it.each([
        [2, 1050],
        [3, 700],
        [4, 525],
        [5, 420],
        [6, 350]
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

    it('refuses more than six players', () => {
        expect(() => table(7)).toThrow()
    })

    it('reaches the stock round once all seven privates have sold', () => {
        const game = table(6)
        buyAllPrivates(game)
        expect(game.state.machineState).toBe('StockRound')
        expect(tableCertificateLimit(game.state)).toBe(9)
    })

    it('gives the Mississippi and Missouri’s buyer a Rock Island share', () => {
        const game = table(4)
        for (const [lotId, expectedPrice] of [
            ['GRSC', 20],
            ['CM', 40],
            ['MRBC', 40],
            ['GBCC', 50],
            ['MMC', 80],
            ['WLGC', 90]
        ] as const)
            game.act('BuyAuctionLot', { lotId, expectedPrice })
        const buyer = game.player
        game.act('BuyAuctionLot', { lotId: 'MMR', expectedPrice: 160 })
        expect(sharesOwned(game.state, 'RI', owner(buyer))).toBe(1)
    })

    it('forbids sales in the first stock round', () => {
        const game = table(4)
        buyAllPrivates(game)
        const player = game.player
        launch(game, 'GN', 100)
        expect(game.valid(player)).not.toContain('SellShares')
    })
})
