import { describe, expect, it } from 'vitest'
import { finiteCashOwnedBy, presidentCertificate } from '@tabletop/18xx'
import { edit, kit } from '../test/kit.js'
import { MajorIdsChesapeake, PrivatesChesapeake } from './companies.js'
import { StockRulesChesapeake } from './stock.js'
import { BopShareId } from './opening.js'
import { TrainDepotChesapeake } from './trains.js'

const twoTrains = (game: ReturnType<typeof kit.table>) =>
    TrainDepotChesapeake.remaining(game.state.trainInventory, '2')

describe('18Chesapeake opening', () => {
    it('deals the starting cash from an $8,000 bank (§3)', () => {
        const game = kit.table(4)
        expect(finiteCashOwnedBy(game.state, { kind: 'player', playerId: 'p1' })).toBe(600)
        expect(finiteCashOwnedBy(game.state, { kind: 'bank' })).toBe(8000 - 4 * 600)
        expect(finiteCashOwnedBy(kit.table(2).state, { kind: 'player', playerId: 'p1' })).toBe(1200)
    })

    it('draws Cornelius Vanderbilt’s company at setup (§3)', () => {
        const drawn = new Set(
            [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => kit.table(4, seed).state.corneliusCompanyId)
        )
        for (const companyId of drawn) expect(MajorIdsChesapeake).toContain(companyId)
        expect(drawn.size).toBeGreaterThan(1)
    })

    it('gives the B&O private’s buyer a B&O share, and Cornelius Vanderbilt’s the drawn presidency and its par (§7.1)', () => {
        const game = kit.table(4)
        kit.buyAllPrivates(game)
        const owner = (id: string) =>
            game.state.certificates.find((entry) => entry.id === id)?.owner
        expect(owner(BopShareId)).toEqual(owner('BOP:charter'))
        const drawn = game.state.corneliusCompanyId
        expect(presidentCertificate(game.state, drawn)?.owner).toEqual(owner('CV:charter'))
        expect(
            game.state.stockMarket.stacks.some((stack) => stack.companyIds.includes(drawn))
        ).toBe(true)
        expect(game.state.machineState).toBe('StockRound')
    })

    it('lowers the Delaware & Raritan by $5 when everyone passes before any sale (§9)', () => {
        const game = kit.table(3)
        for (let pass = 0; pass < 3; pass++) game.act('PassAuction')
        expect(game.state.openingAuction?.discount).toBe(5)
        game.act('BuyAuctionLot', { lotId: 'DR', expectedPrice: 15 })
        expect(game.state.openingAuction?.awards.at(-1)).toMatchObject({ lotId: 'DR', price: 15 })
    })

    it('pays income and exports a 2-train when everyone passes after a sale (§9, §11.9)', () => {
        const game = kit.table(3)
        game.act('BuyAuctionLot', { lotId: 'DR', expectedPrice: 20 })
        const owner = game.state.certificates.find((entry) => entry.id === 'DR:charter')?.owner
        if (owner?.kind !== 'player') throw new Error('A player owns the D&R')
        const cash = finiteCashOwnedBy(game.state, owner)
        expect(twoTrains(game)).toBe(7)
        for (let pass = 0; pass < 3; pass++) game.act('PassAuction')
        expect(finiteCashOwnedBy(game.state, owner)).toBe(cash + 5)
        expect(twoTrains(game)).toBe(6)
        const income = game.actions.findLast((action) => action.type === 'ResolveAuction')
        expect(income?.metadata).toMatchObject({
            kind: 'income',
            exports: { trains: [{ definitionId: '2' }] }
        })
        // The stock round after the auction is still the first: no sales in it (§10.2).
        for (const company of PrivatesChesapeake.slice(1)) {
            game.act('BuyAuctionLot', { lotId: company.id, expectedPrice: company.faceValue })
            const pending = game.state.pendingPar
            if (pending)
                game.act(
                    'ParCompany',
                    { companyId: pending.companyId, marketSpaceId: '3:3' },
                    pending.playerId
                )
        }
        expect(game.state.machineState).toBe('StockRound')
        expect(game.state.stockRound.number).toBe(1)
        expect(
            StockRulesChesapeake.saleTerms(game.hydrated, game.state.corneliusCompanyId, 1, owner)
        ).toMatch(/first stock round/)
    })

    it('makes every president’s certificate a triple at a two-player table but Cornelius Vanderbilt’s (§14.1)', () => {
        const { state } = kit.table(2, 3)
        for (const companyId of MajorIdsChesapeake) {
            const shares = state.certificates.filter(
                (entry) => entry.companyId === companyId && entry.kind === 'share'
            )
            expect(
                shares.reduce((sum, entry) => sum + (entry.kind === 'share' ? entry.shares : 0), 0)
            ).toBe(10)
            expect(presidentCertificate(state, companyId)?.shares).toBe(
                companyId === state.corneliusCompanyId ? 2 : 3
            )
        }
    })

    it('exports every 2-train, then the first 3-train, starting phase 3 within the auction (§9, §11.9)', () => {
        const game = kit.table(3)
        game.act('BuyAuctionLot', { lotId: 'DR', expectedPrice: 20 })
        edit(game, (state) => {
            while (TrainDepotChesapeake.nextTrain(state.trainInventory, '2'))
                TrainDepotChesapeake.export(state.trainInventory, '2')
        })
        for (let pass = 0; pass < 3; pass++) game.act('PassAuction')
        expect(game.state.phaseId).toBe('3')
        expect(TrainDepotChesapeake.remaining(game.state.trainInventory, '3')).toBe(5)
        expect(game.state.machineState).toBe('WaterfallAuction')
        expect(game.actions.some((action) => action.type === 'AdvancePhase')).toBe(true)
    })
})
