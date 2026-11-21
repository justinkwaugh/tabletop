import { describe, expect, it } from 'vitest'
import { finiteCashOwnedBy, presidentCertificate } from '@tabletop/18xx'
import { kit } from '../test/kit.js'
import { Majors1882, NeutralHolders1882 } from './companies.js'
import { NeutralStations1882 } from './neutralStationDefinitions.js'
import { TrainDepot1882 } from './trains.js'
import { trestleShareId } from './opening.js'

describe('1882 opening', () => {
    it('deals the starting cash from a $9,000 bank (§3)', () => {
        const game = kit.table(4)
        expect(finiteCashOwnedBy(game.state, { kind: 'player', playerId: 'p1' })).toBe(450)
        expect(finiteCashOwnedBy(game.state, { kind: 'bank' })).toBe(9000 - 4 * 450)
    })

    it('sets the four extra trains aside (§3, §11.7)', () => {
        const { trainInventory } = kit.table(4).state
        expect(
            ['2', '3', '4', '5', '6'].map((id) => TrainDepot1882.remaining(trainInventory, id))
        ).toEqual([6, 4, 3, 2, 2])
    })

    it('gives each company its stations, and a neutral one to the holders and the supply (ruling 13)', () => {
        expect(
            Object.fromEntries(
                Majors1882.map((company) => [company.id, company.stationCosts.length])
            )
        ).toEqual({ CN: 0, CNoR: 3, CPR: 4, GTP: 3, HBR: 3, QL: 2, SCR: 1 })
        expect(NeutralHolders1882).toEqual(['CNoR', 'GTP', 'HBR', 'QL', 'SCR'])
        expect(NeutralStations1882).toHaveLength(6)
        expect(NeutralStations1882.filter((station) => !station.heldBy)).toHaveLength(1)
    })

    it('draws the rebellion train and the Trestle Bridge share at setup (§3)', () => {
        const draws = new Set(
            [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
                const { rebellion, trestleShareCompanyId } = kit.table(4, seed).state
                expect(['3', '4', '5', '6']).toContain(rebellion.definitionId)
                expect(['CNoR', 'CPR', 'GTP', 'HBR', 'QL']).toContain(trestleShareCompanyId)
                return `${rebellion.definitionId}:${trestleShareCompanyId}`
            })
        )
        expect(draws.size).toBeGreaterThan(1)
    })

    it('lowers the cheapest unsold private by $5 when everyone passes (§9)', () => {
        const game = kit.table(3)
        for (let pass = 0; pass < 3; pass++) game.act('PassAuction')
        expect(game.state.openingAuction?.discount).toBe(5)
        game.act('BuyAuctionLot', { lotId: 'HB', expectedPrice: 15 })
        // The discount ends with its private; the next one falls from its own price.
        expect(game.state.openingAuction?.discount).toBe(0)
        for (let pass = 0; pass < 3; pass++) game.act('PassAuction')
        game.act('BuyAuctionLot', { lotId: 'SC', expectedPrice: 45 })
        expect(game.state.openingAuction?.awards.at(-1)).toMatchObject({ lotId: 'SC', price: 45 })
    })

    it('gives the Trestle Bridge’s buyer its share, and the Canadian Pacific’s the CPR presidency (§7.1)', () => {
        const game = kit.table(4)
        kit.buyAllPrivates(game)
        const tb = game.state.certificates.find((entry) => entry.companyId === 'TB')
        const share = game.state.certificates.find(
            (entry) => entry.id === trestleShareId(game.state.trestleShareCompanyId)
        )
        expect(share?.owner).toEqual(tb?.owner)
        const cp = game.state.certificates.find((entry) => entry.companyId === 'CP')
        expect(presidentCertificate(game.state, 'CPR')?.owner).toEqual(cp?.owner)
        expect(
            game.state.stockMarket.stacks.some((stack) => stack.companyIds.includes('CPR'))
        ).toBe(true)
    })
})
