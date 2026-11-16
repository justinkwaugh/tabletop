import { describe, expect, it } from 'vitest'
import { finiteCashOwnedBy, getCompany } from '@tabletop/18xx'
import { auctionMinor, edit, kit, opened, sellPrivates } from '../test/kit.js'
import { companyOnOffer1861 } from './stock.js'

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

describe('1861 companies on offer (§7.2, §9.2, §12)', () => {
    const onOffer = (phaseId: string) => {
        const game = opened(4)
        edit(game, (state) => {
            state.phaseId = phaseId
        })
        const offered = game.state.companies.filter((company) =>
            companyOnOffer1861(game.state, company.id)
        )
        return {
            minors: offered.filter((company) => company.kind === 'minor').length,
            majors: offered.filter((company) => company.kind === 'major').length
        }
    }

    it('offers ten minors at first, all sixteen from phase 3 and the majors from phase 4', () => {
        expect(onOffer('2')).toEqual({ minors: 10, majors: 0 })
        expect(onOffer('3')).toEqual({ minors: 16, majors: 0 })
        expect(onOffer('4')).toEqual({ minors: 16, majors: 8 })
        expect(onOffer('5')).toEqual({ minors: 0, majors: 8 })
    })
})
