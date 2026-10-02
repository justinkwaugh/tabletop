import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    cashOwnedBy,
    companyMarketSpace,
    crisisSales,
    evaluateCrisisSale,
    getCompany,
    type EighteenXXState
} from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'
import {
    EighteenSeventeenCashCrisisRules,
    EighteenSeventeenStockRules,
    isLiquidated
} from './index.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'

function setCash(state: EighteenXXState, owner: 'company' | 'player', id: string, amount: number) {
    const cash = state.cash.find((cash) =>
        cash.owner.kind === 'company'
            ? owner === 'company' && cash.owner.companyId === id
            : cash.owner.kind === 'player' && owner === 'player' && cash.owner.playerId === id
    )
    assertExists(cash, 'The owner holds cash')
    cash.amount = amount
}

// BA (blair) operates first, then PLE (alex), whose two loans at 10% it cannot pay: the
// company is liquidated and alex owes the $20 interest.
function pleDefaults(prepare: (state: EighteenXXState) => void = () => {}) {
    const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
        state.interestRate = 10
        getCompany(state, 'PLE').loans = 2
        setCash(state, 'company', 'PLE', 0)
        setCash(state, 'player', 'alex', 0)
        prepare(state)
    })
    play.act('FinishTrack', { companyId: 'BA' })
    play.act('FinishTrains', { companyId: 'BA' })
    play.act('FinishOperatingTurn', { companyId: 'BA' })
    // At its loan limit and without cash, PLE finishes its train step at once.
    play.act('FinishTrack', { companyId: 'PLE' })
    return play
}

const alex = { kind: 'player' as const, playerId: 'alex' }

const cash = (play: ExamplePlay, playerId: string) =>
    cashOwnedBy(play.state, { kind: 'player', playerId })

describe('a cash crisis', () => {
    it('leaves the president owing the interest a liquidated company could not pay', () => {
        const play = pleDefaults()
        expect(isLiquidated(play.state.stockMarket, 'PLE')).toBe(true)
        expect(play.state.machineState).toBe('RaisingCash')
        expect(play.state.cashCrisis).toEqual({
            debts: [{ playerId: 'alex', amount: 20 }],
            continuation: 'RepayingLoans'
        })
        expect(play.valid('alex')).toEqual(['SellSharesToPay', 'GoBankrupt'])
    })

    it('is settled by selling only as many shares as needed, at no price drop', () => {
        const play = pleDefaults()
        const price = companyMarketSpace(play.state.stockMarket, 'BA').price
        expect(() =>
            play.act('SellSharesToPay', {
                sale: { companyId: 'BA', shares: 2 },
                expectedProceeds: 2 * price
            })
        ).toThrow()
        play.act('SellSharesToPay', {
            sale: { companyId: 'BA', shares: 1 },
            expectedProceeds: price
        })
        expect(play.state.cashCrisis).toBeUndefined()
        expect(cash(play, 'alex')).toBe(price - 20)
        expect(companyMarketSpace(play.state.stockMarket, 'BA').price).toBe(price)
        expect(play.state.machineState).not.toBe('RaisingCash')
    })
})

describe('crisis sales', () => {
    it('may sell a company that has not yet operated', () => {
        const state = structuredClone(pleDefaults().state)
        getCompany(state, 'BA').operated = false
        expect(EighteenSeventeenStockRules.saleTerms(state, 'BA', 1, alex)).toBeTypeOf('string')
        expect(EighteenSeventeenCashCrisisRules.saleTerms(state, 'BA', 1, alex)).toEqual(
            expect.objectContaining({ price: companyMarketSpace(state.stockMarket, 'BA').price })
        )
    })

    it('never passes on a presidency', () => {
        // Alex, in debt, presides BA with two shares; blair holds two others.
        const state = structuredClone(pleDefaults().state)
        for (const certificate of state.certificates)
            if (!certificate.retired && certificate.companyId === 'BA') {
                if (certificate.kind === 'share' && certificate.president) certificate.owner = alex
                else if (certificate.id === 'BA:share:1' || certificate.id === 'BA:share:2') {
                    certificate.owner = { kind: 'player', playerId: 'blair' }
                    delete certificate.poolId
                }
            }
        getCompany(state, 'BA').president = alex
        expect(
            evaluateCrisisSale(state, EighteenSeventeenCashCrisisRules, 'alex', {
                companyId: 'BA',
                shares: 2
            }).reason
        ).toBe('This sale would pass on a presidency.')
        expect(crisisSales(state, EighteenSeventeenCashCrisisRules, 'alex')).toEqual([])
    })
})

describe('bankruptcy', () => {
    it('takes the player’s shares and cash, liquidates their companies and removes them', () => {
        const play = pleDefaults()
        play.act('GoBankrupt')
        expect(play.state.bankruptPlayerIds).toEqual(['alex'])
        expect(play.state.turnManager.turnOrder).not.toContain('alex')
        expect(getCompany(play.state, 'PLE').president).toBeUndefined()
        expect(getCompany(play.state, 'BA').president).toEqual({
            kind: 'player',
            playerId: 'blair'
        })
        expect(
            play.state.certificates.find((certificate) => certificate.id === 'BA:share:1')
        ).toMatchObject({ owner: { kind: 'bank' }, poolId: 'market' })
        expect(cash(play, 'alex')).toBe(0)
        expect(
            play.state.certificates.some(
                (certificate) =>
                    !certificate.retired &&
                    certificate.owner.kind === 'player' &&
                    certificate.owner.playerId === 'alex' &&
                    certificate.kind === 'share'
            )
        ).toBe(false)
        expect(play.state.machineState).toBe('MergerRound')
        play.act('PassMerger', { companyId: 'BA' })
        expect(play.state.operatingSet?.roundNumber).toBe(2)
        expect(play.state.operatingSet?.companyOrder).toEqual(['BA'])
        expect(play.state.gameEnding).toBeUndefined()
        expect(
            EighteenSeventeenStockRules.certificateLimit(play.state, {
                kind: 'player',
                playerId: 'blair'
            })
        ).toBe(21)
    })

    it('ends the game at once when one player is left', () => {
        const play = pleDefaults((state) => {
            state.bankruptPlayerIds = ['casey']
            state.turnManager.turnOrder = state.turnManager.turnOrder.filter((id) => id !== 'casey')
        })
        play.act('GoBankrupt')
        expect(play.state.gameEnding).toEqual({ reason: 'Bankruptcy' })
        expect(play.state.machineState).toBe('GameOver')
    })
})
