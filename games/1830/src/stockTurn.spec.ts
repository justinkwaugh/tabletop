import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    cashOwnedBy,
    evaluateSharePurchase,
    evaluateShareSale,
    placeStockMarker,
    privateOwner,
    type EighteenXXState
} from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { Definition } from './definition/gameDefinition.js'
import { EighteenThirtyStockRules } from './index.js'
import { EighteenThirtyScenarios } from './scenarios/index.js'

const alex = { kind: 'player', playerId: 'alex' } as const

// The trading example: the second stock round with alex to act.
function trading(prepare: (state: EighteenXXState) => void = () => {}) {
    const { game, engine, state: initial } = exampleGame(EighteenThirtyScenarios, 'trading', 3)
    let state: EighteenXXState = structuredClone(initial)
    prepare(state)
    const validator = Definition.runtime.canonicalStateValidator
    const act = (type: string, fields: object = {}) => {
        const action: GameAction = {
            id: `action:${state.actionCount}`,
            gameId: game.id,
            source: ActionSource.User,
            playerId: state.activePlayerIds[0],
            type,
            ...fields
        }
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
        expect(validator?.Check(state)).toBe(true)
    }
    return {
        get state() {
            return state
        },
        act,
        valid: (playerId: string) => engine.getValidActionTypesForPlayer(game, state, playerId),
        sell(companyId: string, shares = 1) {
            const request = { playerId: 'alex', seller: alex, sales: [{ companyId, shares }] }
            const result = evaluateShareSale(state, request, EighteenThirtyStockRules)
            expect(result.reason).toBeUndefined()
            act('SellShares', { ...request, expectedProceeds: result.details!.proceeds })
            return result.details!.proceeds
        },
        purchase(certificateId: string) {
            return evaluateSharePurchase(
                state,
                { playerId: 'alex', buyer: alex, certificateId },
                EighteenThirtyStockRules
            )
        },
        buy(certificateId: string) {
            const result = this.purchase(certificateId)
            expect(result.reason).toBeUndefined()
            act('BuyShares', { buyer: alex, certificateId, expectedPrice: result.details!.price })
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
                if (certificate && !certificate.retired && certificate.kind === 'share')
                    certificate.poolId = 'open-market'
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
        // Standing instructions stay available to every player.
        expect(turn.valid('casey')).toEqual(['AnswerPrivatePurchase', 'SetStockInstruction'])
        expect(turn.valid('alex')).toEqual(['SetStockInstruction'])
        turn.act('AnswerPrivatePurchase', { accept: true })
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
        turn.act('AnswerPrivatePurchase', { accept: false })
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
        const rules = EighteenThirtyStockRules.privateSales!
        expect(rules.priceRange(first.state, 'BOP')).toBeUndefined()
    })
})
