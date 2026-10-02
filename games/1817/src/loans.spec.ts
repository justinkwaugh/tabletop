import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    cashOwnedBy,
    companyMarketSpace,
    getCompany,
    unownedTrain,
    type EighteenXXState
} from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'
import {
    EighteenSeventeenLoanRules,
    EighteenSeventeenTransferRules,
    isLiquidated
} from './index.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'

const treasury = (state: EighteenXXState, companyId: string) =>
    cashOwnedBy(state, { kind: 'company', companyId })
const price = (state: EighteenXXState, companyId: string) =>
    companyMarketSpace(state.stockMarket, companyId).price

function setCash(state: EighteenXXState, companyId: string, amount: number) {
    const cash = state.cash.find(
        (cash) => cash.owner.kind === 'company' && cash.owner.companyId === companyId
    )
    assertExists(cash, 'The company holds cash')
    cash.amount = amount
}

function setLoans(state: EighteenXXState, companyId: string, loans: number) {
    getCompany(state, companyId).loans = loans
}

// BA operates first in this position, laying track; its president is blair.
function operating(prepare: (state: EighteenXXState) => void = () => {}) {
    return playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
        state.interestRate = 10
        prepare(state)
    })
}

// Finishes every remaining turn of the round without building, buying or borrowing.
function finishRound(play: ExamplePlay) {
    const round = play.state.operatingSet?.roundNumber
    for (let step = 0; step < 20 && play.state.operatingSet?.roundNumber === round; step++) {
        const actions = play.valid(play.state.activePlayerIds[0])
        const companyId =
            play.state.trackStep?.companyId ??
            play.state.loanStep?.companyId ??
            play.state.trainPurchaseStep?.companyId
        const finish = ['FinishTrack', 'FinishTrains', 'FinishOperatingTurn'].find((type) =>
            actions.includes(type)
        )
        assertExists(finish, `No way to finish in ${play.state.machineState}`)
        play.act(finish, { companyId })
    }
}

function toLoanStep(play: ExamplePlay) {
    play.act('FinishTrack', { companyId: 'BA' })
    expect(play.state.machineState).toBe('BuyingTrains')
    play.act('FinishTrains', { companyId: 'BA' })
    expect(play.state.machineState).toBe('RepayingLoans')
}

describe('the interest rate', () => {
    it('is 5% for each five loans in the game, rounded up, from 5% to 70%', () => {
        const rate = (loans: number) =>
            EighteenSeventeenLoanRules.rate(
                operating((state) => {
                    if (loans) setLoans(state, 'BA', loans)
                }).state
            )
        expect(rate(0)).toBe(5)
        expect(rate(5)).toBe(5)
        expect(rate(6)).toBe(10)
        expect(rate(7)).toBe(10)
    })

    it('is fixed when an operating round starts', () => {
        const play = operating((state) => {
            state.interestRate = 5
            setLoans(state, 'BA', 5)
            setLoans(state, 'PLE', 2)
        })
        finishRound(play)
        expect(play.state.operatingSet?.roundNumber).toBe(2)
        expect(play.state.interestRate).toBe(10)
    })
})

describe('loans in the operating turn', () => {
    it('pays $100 and moves the price one space left, up to the share count', () => {
        const play = operating()
        const before = price(play.state, 'BA')
        expect(play.valid('blair')).toContain('TakeLoan')
        play.act('TakeLoan', { companyId: 'BA' })
        expect(treasury(play.state, 'BA')).toBe(300)
        expect(getCompany(play.state, 'BA').loans).toBe(1)
        expect(price(play.state, 'BA')).toBeLessThan(before)
        for (let loan = 1; loan < 5; loan++) play.act('TakeLoan', { companyId: 'BA' })
        expect(play.valid('blair')).not.toContain('TakeLoan')
        expect(() => play.act('TakeLoan', { companyId: 'BA' })).toThrow()
    })

    it('pays interest after trains, borrowing automatically while the treasury is short', () => {
        const play = operating((state) => {
            setLoans(state, 'BA', 2)
            setCash(state, 'BA', 0)
        })
        const before = price(play.state, 'BA')
        toLoanStep(play)
        expect(getCompany(play.state, 'BA').loans).toBe(3)
        expect(treasury(play.state, 'BA')).toBe(70)
        expect(price(play.state, 'BA')).toBeLessThan(before)
        expect(isLiquidated(play.state.stockMarket, 'BA')).toBe(false)
        expect(play.state.loanStep).toEqual({ companyId: 'BA' })
    })

    it('liquidates a company that cannot pay at its limit, and its president pays', () => {
        const play = operating((state) => {
            setLoans(state, 'BA', 5)
            setCash(state, 'BA', 20)
        })
        const blair = cashOwnedBy(play.state, { kind: 'player', playerId: 'blair' })
        play.act('FinishTrack', { companyId: 'BA' })
        play.act('FinishTrains', { companyId: 'BA' })
        expect(isLiquidated(play.state.stockMarket, 'BA')).toBe(true)
        expect(treasury(play.state, 'BA')).toBe(0)
        expect(cashOwnedBy(play.state, { kind: 'player', playerId: 'blair' })).toBe(
            Number(blair) + 20 - 50
        )
        expect(play.state.machineState).not.toBe('RepayingLoans')
    })

    it('repays loans after interest until a loan is taken', () => {
        const play = operating((state) => {
            setLoans(state, 'BA', 3)
            setCash(state, 'BA', 400)
        })
        toLoanStep(play)
        expect(treasury(play.state, 'BA')).toBe(370)
        expect(play.valid('blair')).toEqual(['RepayLoan', 'TakeLoan', 'FinishOperatingTurn'])
        play.act('RepayLoan', { companyId: 'BA' })
        play.act('RepayLoan', { companyId: 'BA' })
        expect(getCompany(play.state, 'BA').loans).toBe(1)
        play.act('TakeLoan', { companyId: 'BA' })
        expect(play.valid('blair')).toEqual(['TakeLoan', 'FinishOperatingTurn'])
        play.act('FinishOperatingTurn', { companyId: 'BA' })
        expect(play.state.loanStep).toBeUndefined()
    })

    it('liquidates a company that ends its turn without a train', () => {
        const play = operating((state) => {
            state.trainInventory.trains = state.trainInventory.trains.map((train) =>
                train.status === 'owned' &&
                train.owner.kind === 'company' &&
                train.owner.companyId === 'BA'
                    ? unownedTrain(train, 'removed')
                    : train
            )
        })
        toLoanStep(play)
        play.act('FinishOperatingTurn', { companyId: 'BA' })
        expect(isLiquidated(play.state.stockMarket, 'BA')).toBe(true)
        expect(play.state.trackStep?.companyId).toBe('PLE')
        const train = play.state.trainInventory.trains.find(
            (train) => train.status === 'owned' && train.owner.kind === 'company'
        )
        assertExists(train, 'PLE owns a train')
        expect(
            EighteenSeventeenTransferRules.canPurchase(play.state, 'PLE', {
                kind: 'train',
                trainId: train.id
            })
        ).toBe(false)
        finishRound(play)
        expect(play.state.operatingSet?.companyOrder).toEqual(['PLE'])
    })
})

describe('the stock-round corporate action', () => {
    // Alex acts first; blair presides BA, which has a share in the market.
    function blairsTurn(prepare: (state: EighteenXXState) => void = () => {}) {
        const play = playExample(EighteenSeventeenScenarios, 'trading', 3, prepare)
        play.act('FinishStockTurn')
        expect(play.state.activePlayerIds).toEqual(['blair'])
        return play
    }

    it('buys back market shares with the treasury, in place of the player’s action', () => {
        const play = blairsTurn()
        expect(play.valid('blair')).toEqual(expect.arrayContaining(['TakeLoan', 'BuyBackShares']))
        const before = price(play.state, 'BA')
        play.act('BuyBackShares', { companyId: 'BA', certificateIds: ['BA:share:2'] })
        expect(treasury(play.state, 'BA')).toBe(200 - before)
        expect(
            play.state.certificates.find((certificate) => certificate.id === 'BA:share:2')
        ).toMatchObject({ owner: { kind: 'company', companyId: 'BA' }, poolId: 'treasury:BA' })
        expect(price(play.state, 'BA')).toBe(before)
        expect(play.state.activePlayerIds).toEqual(['casey'])
        expect(play.state.stockRound.passedPlayerIds).not.toContain('blair')
    })

    it('takes loans only before buying back, and then only for that company', () => {
        const play = blairsTurn()
        play.act('TakeLoan', { companyId: 'BA' })
        play.act('TakeLoan', { companyId: 'BA' })
        expect(getCompany(play.state, 'BA').loans).toBe(2)
        expect(play.valid('blair')).toEqual([
            'TakeLoan',
            'BuyBackShares',
            'FinishStockTurn',
            'SetStockInstruction'
        ])
        play.act('BuyBackShares', { companyId: 'BA', certificateIds: ['BA:share:2'] })
        expect(play.state.activePlayerIds).toEqual(['casey'])
        expect(getCompany(play.state, 'BA').loans).toBe(2)
    })

    it('is not open after the player has bought shares', () => {
        const play = blairsTurn()
        play.act('BuyShares', {
            buyer: { kind: 'player', playerId: 'blair' },
            certificateId: 'BA:share:3',
            expectedPrice: price(play.state, 'BA')
        })
        expect(play.valid('blair')).not.toContain('TakeLoan')
        expect(play.valid('blair')).not.toContain('BuyBackShares')
    })
})
