import { describe, expect, it } from 'vitest'
import { assert } from '@tabletop/common'
import {
    cashOwnedBy,
    evaluateSharePurchase,
    evaluateShareSale,
    furtherShareAllowed,
    placeStockMarker,
    privateSaleChoices,
    privateSaleOfferReason,
    privateOwner,
    suggestedPrivateSalePrice,
    type EighteenXXState
} from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { EighteenThirtyStockRules } from './index.js'
import { EighteenThirtyEndingRules } from './endingRules.js'
import { EighteenThirtyScenarios } from './scenarios/index.js'

const alex = { kind: 'player', playerId: 'alex' } as const

// The trading example: the second stock round with alex to act.
function trading(prepare?: (state: EighteenXXState) => void) {
    const play = playExample(EighteenThirtyScenarios, 'trading', 3, prepare)
    return {
        get state() {
            return play.state
        },
        act: play.act,
        valid: play.valid,
        sell(companyId: string, shares = 1) {
            const request = { playerId: 'alex', seller: alex, sales: [{ companyId, shares }] }
            const result = evaluateShareSale(play.state, request, EighteenThirtyStockRules)
            expect(result.reason).toBeUndefined()
            play.act('SellShares', { ...request, expectedProceeds: result.details!.proceeds })
            return result.details!.proceeds
        },
        purchase(certificateId: string) {
            return evaluateSharePurchase(
                play.state,
                { playerId: 'alex', buyer: alex, certificateId },
                EighteenThirtyStockRules
            )
        },
        buy(certificateId: string) {
            const result = this.purchase(certificateId)
            expect(result.reason).toBeUndefined()
            play.act('BuyShares', {
                buyer: alex,
                certificateId,
                expectedPrice: result.details!.price
            })
        }
    }
}

describe('sell-buy-sell', () => {
    it('sells a company twice at the moved price, buys, then sells again', () => {
        const turn = trading()
        const first = turn.sell('PRR')
        const second = turn.sell('PRR')
        expect(second).toBeLessThan(first)
        turn.buy('NYC:share:4')
        turn.sell('PRR')
        expect(turn.state.stockRound.turn.bought).toBe(true)
    })
})

describe('brown-zone purchases', () => {
    const brown = (multipleBrownFromIpo = false) =>
        trading((state) => {
            placeStockMarker(state.stockMarket, 'NYC', '5:0')
            for (const id of ['NYC:share:5', 'NYC:share:6']) {
                const certificate = state.certificates.find((item) => item.id === id)
                if (certificate && certificate.kind === 'share') certificate.poolId = 'open-market'
            }
            if (multipleBrownFromIpo) Object.assign(state, { multipleBrownFromIpo: true })
        })

    it('buys several market shares of one brown company in a turn', () => {
        const turn = brown()
        turn.buy('NYC:share:4')
        turn.buy('NYC:share:5')
        expect(turn.purchase('NYC:share:7').reason).toBe('Only one purchase is allowed this turn.')
        expect(turn.purchase('PRR:share:5').reason).toBe('Only one purchase is allowed this turn.')
        turn.buy('NYC:share:6')
        turn.act('FinishStockTurn')
        expect(turn.state).not.toHaveProperty('stockTurnPurchases')
    })

    it('stops after an IPO share unless the option allows IPO shares', () => {
        const turn = brown()
        turn.buy('NYC:share:7')
        expect(turn.purchase('NYC:share:4').reason).toBe('Only one purchase is allowed this turn.')
        const option = brown(true)
        option.buy('NYC:share:7')
        option.buy('NYC:share:8')
        option.buy('NYC:share:4')
    })

    it('ends the run after a company start this turn', () => {
        const turn = brown()
        const state = {
            ...turn.state,
            stockRound: {
                ...turn.state.stockRound,
                turn: { ...turn.state.stockRound.turn, bought: true }
            },
            stockTurnPurchases: [{ kind: 'start' as const, companyId: 'CO' }]
        }
        const certificate = state.certificates.find((item) => item.id === 'NYC:share:4')
        assert(certificate && certificate.kind === 'share')
        expect(furtherShareAllowed(state, certificate, EighteenThirtyStockRules)).toBe(false)
        expect(
            furtherShareAllowed(
                {
                    ...state,
                    stockTurnPurchases: [{ kind: 'share', companyId: 'NYC', poolId: 'open-market' }]
                },
                certificate,
                EighteenThirtyStockRules
            )
        ).toBe(true)
    })

    it('allows one purchase outside the brown zone', () => {
        const turn = trading()
        turn.buy('NYC:share:4')
        expect(turn.purchase('NYC:share:5').reason).toBe('Only one purchase is allowed this turn.')
    })
})

describe('private sales between players', () => {
    it('moves the private and cash when the owner accepts, and continues the turn', () => {
        const turn = trading()
        const cash = (playerId: string) => cashOwnedBy(turn.state, { kind: 'player', playerId })
        const [alexCash, caseyCash] = [cash('alex'), cash('casey')]
        turn.act('OfferPrivatePurchase', { privateCompanyId: 'CS', price: 75 })
        expect(turn.state.activePlayerIds).toEqual(['casey'])
        expect(turn.valid('casey')).toContain('RespondToPurchaseOffer')
        expect(turn.valid('alex')).not.toContain('BuyShares')
        turn.act('RespondToPurchaseOffer', { offerId: turn.state.purchaseOffer!.id, accept: true })
        expect(privateOwner(turn.state, 'CS')).toEqual(alex)
        expect(cash('alex')).toBe(Number(alexCash) - 75)
        expect(cash('casey')).toBe(Number(caseyCash) + 75)
        expect(turn.state.activePlayerIds).toEqual(['alex'])
        expect(turn.state.stockRound.turn.bought).toBe(true)
        expect(turn.valid('alex')).not.toContain('OfferPrivatePurchase')
    })

    it('leaves the private and the turn unchanged when the owner declines', () => {
        const turn = trading()
        turn.act('OfferPrivatePurchase', { privateCompanyId: 'CS', price: 75 })
        turn.act('RespondToPurchaseOffer', { offerId: turn.state.purchaseOffer!.id, accept: false })
        expect(privateOwner(turn.state, 'CS')).toEqual({ kind: 'player', playerId: 'casey' })
        expect(turn.state.activePlayerIds).toEqual(['alex'])
        expect(turn.state.stockRound.turn.bought).toBe(false)
        expect(turn.valid('alex')).toContain('OfferPrivatePurchase')
    })

    it('sells no privates between players in the first stock round or for the B&O', () => {
        const first = trading((state) => {
            state.stockRound.number = 1
        })
        expect(first.valid('alex')).not.toContain('OfferPrivatePurchase')
        const withBaltimore = trading((state) => {
            state.companies.push({
                id: 'BOP',
                kind: 'private',
                privateRevenue: 30
            })
            state.certificates.push({
                id: 'BOP:charter',
                companyId: 'BOP',
                kind: 'private',
                owner: { kind: 'player', playerId: 'casey' }
            })
        })
        expect(
            privateSaleOfferReason(withBaltimore.state, EighteenThirtyStockRules, {
                playerId: 'alex',
                privateCompanyId: 'BOP',
                price: 220
            })
        ).toBe('This private cannot be sold between players now.')
        expect(
            privateSaleChoices(withBaltimore.state, EighteenThirtyStockRules, 'alex').map(
                (choice) => choice.privateCompanyId
            )
        ).toEqual(['CS'])
    })

    it('lets a player over a holding limit only sell', () => {
        const turn = trading((state) => {
            for (const id of ['PRR:share:5', 'PRR:share:6', 'PRR:share:7', 'PRR:share:8']) {
                const certificate = state.certificates.find((item) => item.id === id)
                if (certificate && certificate.kind === 'share') {
                    certificate.owner = alex
                    delete certificate.poolId
                }
            }
        })
        expect(
            privateSaleOfferReason(turn.state, EighteenThirtyStockRules, {
                playerId: 'alex',
                privateCompanyId: 'CS',
                price: 75
            })
        ).toBe('Sell down to the stock limits before buying.')
        expect(turn.valid('alex')).not.toContain('OfferPrivatePurchase')
    })

    it('suggests the private’s value as the starting offer, within the price bounds', () => {
        const turn = trading()
        const [choice] = privateSaleChoices(turn.state, EighteenThirtyStockRules, 'alex')
        const suggest = (range: { minimum: number; maximum?: number }) =>
            suggestedPrivateSalePrice(turn.state, { ...choice, range }, EighteenThirtyEndingRules)
        expect(choice.privateCompanyId).toBe('CS')
        expect(suggest(choice.range)).toBe(40)
        expect(suggest({ minimum: 50 })).toBe(50)
        expect(suggest({ minimum: 1, maximum: 30 })).toBe(30)
    })
})
