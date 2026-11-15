import { describe, expect, it } from 'vitest'
import { finiteCashOwnedBy, getCompany } from '@tabletop/18xx'
import { auctionMinor, kit, sellPrivates } from '../test/kit.js'

describe('1861 opening', () => {
    it('auctions the privates in order, then the Nikolaev first', () => {
        const game = kit.table(4)
        expect(game.state.machineState).toBe('SelectionAuction')
        const first = game.player
        sellPrivates(game)
        expect(game.state.machineState).toBe('StockRound')
        expect(game.state.certificates.find((c) => c.companyId === 'TSR')?.owner).toEqual({
            kind: 'player',
            playerId: first
        })
        expect(game.valid()).toContain('AuctionCompany')
        auctionMinor(game, 'N', 120)
        expect(getCompany(game.state, 'N').started).toBe(true)
        expect(finiteCashOwnedBy(game.state, { kind: 'company', companyId: 'N' })).toBe(120)
    })

    it('lowers a private by R5 when every player passes', () => {
        const game = kit.table(3)
        for (let i = 0; i < 3; i++) game.act('PassSelectionAuction')
        expect(game.state.machineState).toBe('SelectionAuction')
        expect(game.state.selectionAuction?.discount).toBe(5)
        const nominator = game.player
        game.act('NominateLot', { lotId: 'TSR', amount: 15 })
        while (game.state.selectionAuction?.bidding) game.act('PassSelectionAuction')
        expect(game.state.selectionAuction?.discount).toBeUndefined()
        expect(game.state.certificates.find((c) => c.companyId === 'TSR')?.owner).toEqual({
            kind: 'player',
            playerId: nominator
        })
    })
})

describe('1861 optional rules', () => {
    it('stocks two of each special train only without the unlimited option (GTG §14)', () => {
        const count = (config?: Record<string, boolean>) =>
            kit
                .table(3, 7, config)
                .state.trainInventory.trains.filter(
                    (train) => train.definitionId === '2+2' || train.definitionId === '5+5E'
                ).length
        expect(count()).toBe(0)
        expect(count({ unlimitedSpecialTrains: false })).toBe(4)
    })
})
