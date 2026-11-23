import { describe, expect, it } from 'vitest'
import { CompanyAuctionModel, cashOwnedBy, getCompany } from '@tabletop/18xx'
import { edit, kit } from '../test/kit.js'
import {
    emptyTreasury,
    givePrivate,
    passOpening,
    presidentHoldingFive,
    setCash
} from '../test/positions.js'
import { EighteenUSAMarket, EighteenUSAStockRules } from './index.js'

const Portland = { locationId: 'C3', nodeId: 'city' }
const KansasCity = { locationId: 'E15', nodeId: 'city' }

function started(subsidyId?: string) {
    const game = kit.table(3, 2)
    passOpening(game)
    if (subsidyId)
        edit(game, (state) => {
            state.citySubsidies = { ...state.citySubsidies, C3: subsidyId }
        })
    return game
}

const treasury = (game: ReturnType<typeof started>, companyId: string) =>
    cashOwnedBy(game.state, { kind: 'company', companyId })
const cash = (game: ReturnType<typeof started>, playerId: string) =>
    cashOwnedBy(game.state, { kind: 'player', playerId })

function win(game: ReturnType<typeof started>, amount: number, home = KansasCity) {
    const opener = game.player
    game.act('AuctionCompany', { companyId: 'ATSF', amount, home })
    while (game.state.companyAuction)
        if (game.valid(game.player).includes('FormCompany'))
            game.act('FormCompany', { companyId: 'ATSF', shareCount: 2, privateIds: [] })
        else game.act('PassCompanyAuction', { companyId: 'ATSF' })
    return opener
}

describe('company auctions (§11.6)', () => {
    it('raises bids by $1 from $100', () => {
        const game = started()
        game.act('AuctionCompany', { companyId: 'ATSF', amount: 100, home: KansasCity })
        expect(() => game.act('BidForCompany', { companyId: 'ATSF', amount: 100 })).toThrow()
        game.act('BidForCompany', { companyId: 'ATSF', amount: 101 })
        expect(
            game.state.companyAuction?.auction.participants.some((entry) => entry.bid === 101)
        ).toBe(true)
    })

    it('starts at half the bid and gives the treasury twice the start price', () => {
        const game = started()
        const opener = game.player
        const before = Number(cash(game, opener))
        win(game, 105)
        expect(EighteenUSAMarket.companySpace(game.state.stockMarket, 'ATSF').price).toBe(50)
        expect(treasury(game, 'ATSF')).toBe(100)
        expect(cash(game, opener)).toBe(before - 105)
    })

    it('caps the start price at $200 however high the bid', () => {
        const game = started()
        const opener = game.player
        setCash(game, opener, 600)
        win(game, 500)
        expect(getCompany(game.state, 'ATSF').parPrice).toBe(200)
        expect(treasury(game, 'ATSF')).toBe(400)
        expect(cash(game, opener)).toBe(100)
    })

    it('counts a city’s cash subsidy as the winner’s equity: $106 from $76 in Portland', () => {
        const game = started('cash-30-1')
        const opener = game.player
        setCash(game, opener, 76)
        win(game, 106, Portland)
        expect(EighteenUSAMarket.companySpace(game.state.stockMarket, 'ATSF').price).toBe(53)
        expect(treasury(game, 'ATSF')).toBe(106)
        expect(cash(game, opener)).toBe(0)
        expect(game.state.citySubsidies.C3).toBeUndefined()
    })

    it('takes a city’s cash subsidy off what the winner pays to form the company', () => {
        const game = started('cash-30-1')
        const opener = game.player
        edit(game, (state) => givePrivate(state, 'P1', { kind: 'player', playerId: opener }))
        game.act('AuctionCompany', { companyId: 'ATSF', amount: 106, home: Portland })
        while (!game.valid(game.player).includes('FormCompany'))
            game.act('PassCompanyAuction', { companyId: 'ATSF' })
        const auction = new CompanyAuctionModel(game.state, EighteenUSAStockRules)
        expect(auction.formationPayment([])).toEqual({ privatesValue: 0, subsidy: 30, cash: 76 })
    })

    it('puts a city bonus subsidy on the city and removes unclaimed subsidies after the round', () => {
        const game = started('plus-10')
        win(game, 100, Portland)
        expect(game.state.cityBonuses?.C3).toBe('plus-10')
        while (game.state.machineState === 'StockRound') game.act('FinishStockTurn')
        expect(game.state.citySubsidies).toEqual({})
    })
})

describe('no 60% president limit (§17)', () => {
    const presidentShare = (game: ReturnType<typeof started>, president: string) => {
        const share = game.state.certificates.find(
            (certificate) =>
                certificate.kind === 'share' &&
                certificate.companyId === 'ATSF' &&
                !certificate.president &&
                certificate.owner.kind === 'player' &&
                certificate.owner.playerId === president
        )
        if (!share || share.kind !== 'share') throw new Error('The president holds a share')
        return share
    }

    it('lets a president pass 60% in stock rounds only', () => {
        const { game, president } = presidentHoldingFive({ noPresidentLimit: true })
        const owner = { kind: 'player' as const, playerId: president }
        const other = game.state.players.find((player) => player.playerId !== president)
        if (!other) throw new Error('Another player')
        expect(EighteenUSAStockRules.ownershipLimit(game.state, 'ATSF', owner)).toBe(100)
        expect(
            EighteenUSAStockRules.ownershipLimit(game.state, 'ATSF', {
                kind: 'player',
                playerId: other.playerId
            })
        ).toBe(60)
        const merging = { ...game.state, machineState: 'MergerRound' }
        expect(EighteenUSAStockRules.ownershipLimit(merging, 'ATSF', owner)).toBe(60)
        const plain = presidentHoldingFive()
        expect(
            EighteenUSAStockRules.ownershipLimit(plain.game.state, 'ATSF', {
                kind: 'player',
                playerId: plain.president
            })
        ).toBe(60)
    })

    it('sells a president’s share at 10% above the price once no other share is for sale', () => {
        const { game, president } = presidentHoldingFive({ noPresidentLimit: true })
        const buyer = { kind: 'player' as const, playerId: game.player }
        expect(buyer.playerId).not.toBe(president)
        const share = presidentShare(game, president)
        expect(typeof EighteenUSAStockRules.purchaseTerms(game.state, share, buyer)).toBe('string')
        emptyTreasury(game, 'ATSF', president)
        expect(EighteenUSAMarket.companySpace(game.state.stockMarket, 'ATSF').price).toBe(50)
        const premium = 55
        const terms = EighteenUSAStockRules.purchaseTerms(game.state, share, buyer)
        expect(terms).toEqual({
            price: premium,
            recipient: { kind: 'player', playerId: president },
            payers: [buyer]
        })
        const before = Number(cash(game, president))
        game.act('BuyShares', {
            buyer,
            certificateId: share.id,
            expectedPrice: premium
        })
        expect(Number(cash(game, president))).toBe(before + premium)
        expect(
            game.state.certificates.find((certificate) => certificate.id === share.id)?.owner
        ).toEqual(buyer)
    })

    it('sells nothing from a president without the variant', () => {
        const { game, president } = presidentHoldingFive()
        emptyTreasury(game, 'ATSF', president)
        const share = presidentShare(game, president)
        expect(
            typeof EighteenUSAStockRules.purchaseTerms(game.state, share, {
                kind: 'player',
                playerId: game.player
            })
        ).toBe('string')
    })
})
