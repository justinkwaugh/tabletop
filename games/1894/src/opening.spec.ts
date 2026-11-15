import { describe, expect, it } from 'vitest'
import { getCompany, privateOwner } from '@tabletop/18xx'
import { startTable } from '../test/testSupport.js'
import { startingFrenchCompanyId } from './privates.js'

describe('setup (§3)', () => {
    it.each([3, 4] as const)('deals the %i-player opening', (count) => {
        const table = startTable(count)
        const state = table.hydrated
        const french = startingFrenchCompanyId(state)
        expect(['PLM', 'CFOR', 'Nord', 'Ouest', 'Est']).toContain(french)
        for (const player of state.players)
            expect(table.cash(player.playerId)).toBe(count === 3 ? 570 : 480)
        for (const companyId of [french, 'Belge']) {
            const held = state.certificates.filter(
                (certificate) =>
                    certificate.companyId === companyId && certificate.owner.kind === 'player'
            )
            expect(held).toHaveLength(count)
            expect(
                state.certificates.filter(
                    (certificate) =>
                        certificate.companyId === companyId && certificate.poolId === 'open-market'
                )
            ).toHaveLength(count === 3 ? 1 : 0)
        }
        const privates = state.companies.filter((company) => company.kind === 'private')
        // Nine printed privates, less the station private removed at setup.
        expect(privates).toHaveLength(8)
        expect(privates.filter((company) => ['GLG', 'SAC'].includes(company.id))).toHaveLength(1)
        expect(privates.map((company) => company.id)).toContain('BMS')
        expect(state.machineState).toBe('WaterfallAuction')
        expect(state.openingAuction?.remainingLotIds[0]).toBe('LRC')
    })
})

describe('private auction (§5)', () => {
    it('reduces Ligne de Reims after a round of passes, then pays income and floats the majors', () => {
        const table = startTable(3)
        for (let pass = 0; pass < 3; pass++) table.act('PassAuction')
        expect(table.hydrated.openingAuction?.discount).toBe(5)
        table.act('BuyAuctionLot', { lotId: 'LRC', expectedPrice: 15 })
        const buyer = privateOwner(table.hydrated, 'LRC')
        expect(buyer?.kind).toBe('player')
        // A round of passes now pays Ligne de Reims's F5.
        const before = buyer?.kind === 'player' ? table.cash(buyer.playerId) : 0
        for (let pass = 0; pass < 3; pass++) table.act('PassAuction')
        expect(buyer?.kind === 'player' ? table.cash(buyer.playerId) : 0).toBe(before + 5)
    })

    it('gives the Nord minor shareholding a Nord share without the presidency, even when the Nord is drawn', () => {
        const table = startTable(3, 12)
        expect(startingFrenchCompanyId(table.state)).toBe('Nord')
        for (const [lotId, expectedPrice] of [
            ['LRC', 20],
            ['AR', 25],
            ['SAC', 50],
            ['SQG', 70],
            ['LS', 90],
            ['NMinorS', 140]
        ])
            table.act('BuyAuctionLot', { lotId, expectedPrice })
        const buyer = privateOwner(table.hydrated, 'NMinorS')
        expect(
            table.state.certificates.filter(
                (certificate) =>
                    certificate.companyId === 'Nord' &&
                    buyer?.kind === 'player' &&
                    certificate.owner.kind === 'player' &&
                    certificate.owner.playerId === buyer.playerId
            )
        ).toHaveLength(2)
        expect(getCompany(table.hydrated, 'Nord').president).toBeUndefined()
        table.act('BuyAuctionLot', { lotId: 'NMS', expectedPrice: 180 })
        const major = privateOwner(table.hydrated, 'NMS')
        table.act('ParCompany', { companyId: 'Nord', marketSpaceId: '3:5' })
        expect(getCompany(table.hydrated, 'Nord').president).toEqual(major)
    })

    it('rejects a bid that is not a multiple of F5', () => {
        const table = startTable(3)
        expect(() => table.act('ReserveBid', { lotId: 'AR', amount: 32 })).toThrow()
        table.act('ReserveBid', { lotId: 'AR', amount: 35 })
    })

    it('sets the shareholding companies’ par, including F100, and floats them', () => {
        const table = startTable(4)
        const french = startingFrenchCompanyId(table.state) ?? ''
        for (let guard = 0; guard < 40 && table.state.machineState !== 'StockRound'; guard++) {
            const state = table.hydrated
            if (state.pendingPar) {
                table.act('ParCompany', {
                    companyId: state.pendingPar.companyId,
                    marketSpaceId: state.pendingPar.companyId === 'Belge' ? '3:5' : '1:1'
                })
                continue
            }
            const auction = state.openingAuction
            const lotId = auction?.remainingLotIds[0]
            if (!auction || !lotId) break
            const price = table.hydrated.openingAuction?.discount ?? 0
            const cash = table.cash(state.activePlayerIds[0])
            const faces: Record<string, number> = {
                LRC: 20,
                AR: 25,
                GLG: 50,
                SAC: 50,
                SQG: 70,
                LS: 90,
                NMinorS: 140,
                BMS: 200
            }
            const face = faces[lotId] ?? 180
            const cost = face - (lotId === 'LRC' ? price : 0)
            if (cash >= cost) table.act('BuyAuctionLot', { lotId, expectedPrice: cost })
            else table.act('PassAuction')
        }
        expect(table.state.machineState).toBe('StockRound')
        const state = table.hydrated
        expect(getCompany(state, 'Belge').parPrice).toBe(100)
        expect(getCompany(state, french).parPrice).toBe(95)
        expect(getCompany(state, 'Belge').floated).toBe(true)
        expect(getCompany(state, french).floated).toBe(true)
        expect(table.companyCash('Belge')).toBe(1000)
        expect(table.companyCash(french)).toBe(950)
    })
})
