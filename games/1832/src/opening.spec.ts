import { describe, expect, it } from 'vitest'
import { ReserveBidAuction, cashOwnedBy, getCompany } from '@tabletop/18xx'
import { exampleGame, playExample } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoAuctionRules,
    EighteenThirtyTwoStockRules,
    companyAwaitingCapital
} from './index.js'
import {
    EighteenThirtyTwoScenarios,
    buyOpeningPrivates,
    completeOpeningAuction
} from './scenarios/index.js'

const StartingCash = { 2: 1050, 3: 700, 4: 525, 5: 420, 6: 350 } as const
const CertificateLimits = { 2: 28, 3: 20, 4: 16, 5: 13, 6: 11 } as const

describe('the opening', () => {
    it.each([2, 3, 4, 5, 6] as const)('deals $2100 among %i players', (count) => {
        const { state } = exampleGame(EighteenThirtyTwoScenarios, 'opening', count)
        expect(EighteenThirtyTwoScenarios.runtime.canonicalStateValidator?.Check(state)).toBe(true)
        expect(state.companies.filter((company) => company.kind === 'major')).toHaveLength(10)
        expect(
            state.companies.filter((company) => company.kind === 'private').map((c) => c.id)
        ).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P7'])
        expect(
            state.cash.reduce(
                (total, account) =>
                    total + (typeof account.amount === 'number' ? account.amount : 0),
                0
            )
        ).toBe(12000)
        for (const player of state.players)
            expect(cashOwnedBy(state, { kind: 'player', playerId: player.playerId })).toBe(
                StartingCash[count]
            )
        expect(EighteenThirtyTwoStockRules.certificateLimit(state, { kind: 'bank' })).toBe(
            CertificateLimits[count]
        )
        expect(state.machineState).toBe('WaterfallAuction')
    })

    it('gives P7’s buyer the CoG presidency and its par', () => {
        const play = playExample(EighteenThirtyTwoScenarios, 'opening', 3)
        const buyers = buyOpeningPrivates(play)
        expect(play.state.pendingPar).toEqual({ companyId: 'CG', playerId: buyers.P7 })
        play.act('ParCompany', { companyId: 'CG', marketSpaceId: '1:6' }, buyers.P7)
        const central = getCompany(play.state, 'CG')
        expect(central.parPrice).toBe(90)
        expect(central.president).toEqual({ kind: 'player', playerId: buyers.P7 })
        expect(play.state.machineState).toBe('StockRound')
    })

    it('runs the privates and lowers P1 by $5 when everyone passes before buying', () => {
        const play = playExample(EighteenThirtyTwoScenarios, 'opening', 3)
        for (let pass = 0; pass < 3; pass++) play.act('PassAuction')
        const auction = new ReserveBidAuction(play.state, EighteenThirtyTwoAuctionRules)
        expect(auction.price('P1')).toBe(15)
    })

    it('forbids sales in the first stock round', () => {
        const play = playExample(EighteenThirtyTwoScenarios, 'opening', 3)
        completeOpeningAuction(play)
        const player = play.state.activePlayerIds[0]
        play.act('StartCompany', {
            buyer: { kind: 'player', playerId: player },
            companyId: 'ACL',
            marketSpaceId: '0:6',
            expectedPrice: 200
        })
        expect(play.valid(player)).not.toContain('SellShares')
    })
})

describe('flotation', () => {
    it('floats at six shares sold and pays ten times par as the stock round ends', () => {
        const play = playExample(EighteenThirtyTwoScenarios, 'opening', 3)
        completeOpeningAuction(play)
        const player = () => ({ kind: 'player', playerId: play.state.activePlayerIds[0] }) as const
        play.act('StartCompany', {
            buyer: player(),
            companyId: 'ACL',
            marketSpaceId: '1:6',
            expectedPrice: 180
        })
        play.act('FinishStockTurn')
        for (const share of [1, 2, 3, 4]) {
            play.act('BuyShares', {
                buyer: player(),
                certificateId: `ACL:share:${share}`,
                expectedPrice: 90
            })
            play.act('FinishStockTurn')
        }
        const coast = getCompany(play.state, 'ACL')
        expect(coast.floated).toBe(true)
        expect(coast.funded).toBe(false)
        expect(cashOwnedBy(play.state, { kind: 'company', companyId: 'ACL' })).toBe(0)
        expect(companyAwaitingCapital(play.state)).toBe('ACL')
        while (play.state.machineState === 'StockRound') play.act('FinishStockTurn')
        expect(cashOwnedBy(play.state, { kind: 'company', companyId: 'ACL' })).toBe(900)
        expect(getCompany(play.state, 'ACL').funded).toBe(true)
    })
})
