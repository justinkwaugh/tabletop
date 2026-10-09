import { describe, expect, it } from 'vitest'
import { Color, Prng, type PlayerState } from '@tabletop/common'
import { cashOwnedBy, privateOwner, SelectionAuctionModel } from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'
import {
    EighteenSeventeenAuctionRules,
    EighteenSeventeenCertificateLimits,
    EighteenSeventeenStockRules,
    createEighteenSeventeenOpening
} from './index.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'

const StartingCash = [420, 315, 252, 210, 180, 158, 140, 126, 115, 105]
const CertificateLimits = [21, 16, 13, 11, 9, 8, 7, 6, 6, 5]

it.each(StartingCash.map((cash, index) => [index + 3, cash, CertificateLimits[index]]))(
    'opens a %i-player game with $%i each and a certificate limit of %i',
    (count, cash, limit) => {
        const players: PlayerState[] = Array.from({ length: count }, (_, index) => ({
            playerId: `p${index}`,
            color: Color.Blue
        }))
        const { position, titleState } = createEighteenSeventeenOpening({
            players,
            prng: new Prng(1),
            config: {}
        })
        for (const player of players)
            expect(cashOwnedBy(position, { kind: 'player', playerId: player.playerId })).toBe(cash)
        expect(cashOwnedBy(position, { kind: 'bank' })).toBe('unlimited')
        expect(EighteenSeventeenCertificateLimits[count]).toBe(limit)
        expect(titleState).toEqual({ seedMoney: 200 })
        expect(position.companies.filter((company) => company.kind === 'major')).toHaveLength(20)
        expect(position.companies.filter((company) => company.kind === 'private')).toHaveLength(11)
    }
)

function opening(): ExamplePlay & { auction(): SelectionAuctionModel } {
    const play = playExample(EighteenSeventeenScenarios, 'opening', 4)
    return Object.assign(play, {
        auction: () => new SelectionAuctionModel(play.state, EighteenSeventeenAuctionRules)
    })
}

describe('the selection auction', () => {
    it('starts with the first player nominating any private', () => {
        const play = opening()
        expect(play.state.machineState).toBe('SelectionAuction')
        expect(play.valid(play.state.activePlayerIds[0])).toEqual([
            'PassSelectionAuction',
            'NominateLot'
        ])
        expect(play.auction().minimumBid('MINC')).toBe(0)
        expect(play.auction().minimumBid('MAJM')).toBe(0)
    })

    it('sells a $30 private for nothing from the seed money', () => {
        const play = opening()
        const nominator = play.state.activePlayerIds[0]
        play.act('NominateLot', { lotId: 'MINC', amount: 0 })
        for (let pass = 0; pass < 3; pass++) play.act('PassSelectionAuction')
        expect(privateOwner(play.state, 'MINC')).toEqual({ kind: 'player', playerId: nominator })
        expect(play.state).toMatchObject({ seedMoney: 170 })
        expect(play.auction().minimumBid('MAJM')).toBe(0)
        expect(play.auction().minimumBid('MAJC')).toBe(0)
        expect(play.state.activePlayerIds[0]).not.toBe(nominator)
    })

    it('raises bids in $5 steps, passes in seat order after the high bidder, and charges the winner', () => {
        const play = opening()
        const order = play.state.turnManager.turnOrder
        const [first, second] = order
        play.act('NominateLot', { lotId: 'MAJM', amount: 0 })
        expect(play.state.activePlayerIds).toEqual([second])
        expect(() => play.act('BidForLot', { lotId: 'MAJM', amount: 7 })).toThrow()
        play.act('BidForLot', { lotId: 'MAJM', amount: 10 })
        play.act('PassSelectionAuction')
        play.act('PassSelectionAuction')
        expect(play.state.activePlayerIds).toEqual([first])
        play.act('PassSelectionAuction')
        expect(privateOwner(play.state, 'MAJM')).toEqual({ kind: 'player', playerId: second })
        expect(cashOwnedBy(play.state, { kind: 'player', playerId: second })).toBe(305)
        expect(play.state).toMatchObject({ seedMoney: 90 })
        expect(play.state.activePlayerIds).toEqual([second])
    })

    it('closes the unsold privates when every player passes and gives priority to the next nominator', () => {
        const play = opening()
        const order = play.state.turnManager.turnOrder
        play.act('NominateLot', { lotId: 'MINC', amount: 0 })
        for (let pass = 0; pass < 3; pass++) play.act('PassSelectionAuction')
        for (let pass = 0; pass < 4; pass++) play.act('PassSelectionAuction')
        expect(play.state.machineState).toBe('StockRound')
        expect(play.state.stockRound.number).toBe(1)
        expect(
            play.state.companies.filter((company) => company.kind === 'private' && company.closed)
        ).toHaveLength(10)
        expect(play.state.turnManager.turnOrder[0]).toBe(order[1])
        expect(play.state.activePlayerIds).toEqual([order[1]])
    })

    it('drops players who cannot reach the next bid', () => {
        const play = opening()
        const order = play.state.turnManager.turnOrder
        const poor = play.state.cash.find(
            (cash) => cash.owner.kind === 'player' && cash.owner.playerId === order[2]
        )!
        poor.amount = 10
        play.replaceState(play.state)
        play.act('NominateLot', { lotId: 'MAJM', amount: 10 })
        play.act('PassSelectionAuction')
        expect(play.state.activePlayerIds).toEqual([order[3]])
    })
})

it('counts privates outside the certificate limit', () => {
    const play = opening()
    expect(
        EighteenSeventeenStockRules.certificateWeight(play.state, {
            id: 'MINC:charter',
            companyId: 'MINC',
            kind: 'private',
            owner: { kind: 'bank' }
        })
    ).toBe(0)
})
