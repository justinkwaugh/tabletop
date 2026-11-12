import { describe, expect, it } from 'vitest'
import { cashOwnedBy, getCompany, sharesOwned } from '@tabletop/18xx'
import { kit } from '../test/kit.js'

const owner = (playerId: string) => ({ kind: 'player' as const, playerId })

describe('the opening (§2, §8)', () => {
    it.each([
        [3, 500, 5],
        [4, 375, 6],
        [5, 300, 6]
    ])('gives %i players L. %i each and plays %i corporations', (count, cash, corporations) => {
        const game = kit.table(count)
        for (const player of game.state.players)
            expect(cashOwnedBy(game.state, owner(player.playerId))).toBe(cash)
        expect(game.state.corporationOrder).toHaveLength(corporations)
        expect(game.state.machineState).toBe('WaterfallAuction')
    })

    it('plays five corporations with four players when chosen', () => {
        const game = kit.table(4, 7, { fiveCorporations: true })
        expect(game.state.corporationOrder).toHaveLength(5)
        expect(game.state.removedCorporationId).toBeDefined()
    })

    it('keeps the IFT out of the first three when delayed', () => {
        for (let seed = 1; seed < 20; seed++) {
            const game = kit.table(4, seed, { delayIft: true })
            expect(game.state.corporationOrder.indexOf('IFT')).not.toBeLessThan(3)
        }
    })

    it('gives the Reale Società d’Affari’s buyer the first corporation, funded by the bank', () => {
        const game = kit.table(4)
        const first = game.state.corporationOrder[0]
        let buyer = ''
        for (const company of [
            ['SCE', 20],
            ['SIGI', 45],
            ['CNM', 75],
            ['SMS', 110]
        ] as const)
            game.act('BuyAuctionLot', { lotId: company[0], expectedPrice: company[1] })
        buyer = game.player
        game.act('BuyAuctionLot', { lotId: 'RSA', expectedPrice: 150 })
        expect(game.state.pendingPar?.companyId).toBe(first)
        game.act('ParCompany', { companyId: first, marketSpaceId: '3:5' }, buyer)
        expect(game.state.machineState).toBe('StockRound')
        expect(sharesOwned(game.state, first, owner(buyer))).toBe(2)
        const company = getCompany(game.state, first)
        expect(company.floated).toBe(true)
        const fee = { AFG: 40, ATA: 30, CTL: 40, IFT: 90, RCS: 130, SFA: 40 }[first] ?? 0
        expect(cashOwnedBy(game.state, { kind: 'company', companyId: first })).toBe(200 - fee)
    })
})
