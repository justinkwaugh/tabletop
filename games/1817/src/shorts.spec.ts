import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    cashOwnedBy,
    companyMarketSpace,
    getCompany,
    openShort,
    openShorts,
    sharesOwned,
    type EighteenXXState
} from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { EighteenSeventeenEndingRules } from './endingRules.js'
import { EighteenSeventeenStockRoundRules, marketPool, shortReason } from './index.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'

const casey = { kind: 'player' as const, playerId: 'casey' }
const price = (state: EighteenXXState) => companyMarketSpace(state.stockMarket, 'BA').price
const cash = (state: EighteenXXState, playerId: string) =>
    cashOwnedBy(state, { kind: 'player', playerId })

function setPlayerCash(state: EighteenXXState, playerId: string, amount: number) {
    const account = state.cash.find(
        (cash) => cash.owner.kind === 'player' && cash.owner.playerId === playerId
    )
    assertExists(account, 'The player holds cash')
    account.amount = amount
}

// In the stock round alex acts first, then blair (BA's president), then casey, who holds no BA.
function caseysTurn(prepare: (state: EighteenXXState) => void = () => {}) {
    const play = playExample(EighteenSeventeenScenarios, 'trading', 3, prepare)
    play.act('FinishStockTurn')
    play.act('FinishStockTurn')
    expect(play.state.activePlayerIds).toEqual(['casey'])
    return play
}

describe('opening a short', () => {
    it('pays the price, adds a market share and blocks buying the company back that round', () => {
        const play = caseysTurn()
        const before = Number(cash(play.state, 'casey'))
        const drop = EighteenSeventeenStockRoundRules.poolDrop?.(play.state, 'BA')
        expect(play.valid('casey')).toContain('ShortShare')
        play.act('ShortShare', { companyId: 'BA', expectedPrice: price(play.state) })
        expect(cash(play.state, 'casey')).toBe(before + price(play.state))
        expect(sharesOwned(play.state, 'BA', casey)).toBe(-1)
        expect(EighteenSeventeenStockRoundRules.poolDrop?.(play.state, 'BA')).toBe(Number(drop) + 1)
        expect(play.valid('casey')).not.toContain('ShortShare')
        expect(() =>
            play.act('BuyShares', {
                buyer: casey,
                certificateId: 'BA:share:2',
                expectedPrice: price(play.state)
            })
        ).toThrow()
    })

    it('is refused to a holder, after a purchase, and past the company’s limit', () => {
        const play = caseysTurn()
        expect(shortReason(play.state, 'alex', 'BA')).toBeDefined()
        const limited = structuredClone(play.state)
        for (let short = 0; short < 5; short++)
            openShort(limited, 'BA', { kind: 'player', playerId: 'blair' }, marketPool(limited))
        expect(shortReason(limited, 'casey', 'BA')).toBe(
            'This company has as many shorts as it may.'
        )
        const tenShares = structuredClone(play.state)
        getCompany(tenShares, 'BA').shareCount = 10
        for (let short = 0; short < 5; short++)
            openShort(tenShares, 'BA', { kind: 'player', playerId: 'blair' }, marketPool(tenShares))
        expect(shortReason(tenShares, 'casey', 'BA')).toBeUndefined()
        expect(shortReason({ ...tenShares, fiveShorts: true }, 'casey', 'BA')).toBe(
            'This company has as many shorts as it may.'
        )
        play.act('BuyShares', {
            buyer: casey,
            certificateId: 'BA:share:2',
            expectedPrice: price(play.state)
        })
        expect(shortReason(play.state, 'casey', 'BA')).toBeDefined()
    })
})

describe('closing a short', () => {
    it('retires the bought share with the short', () => {
        const play = caseysTurn((state) => {
            openShort(state, 'BA', casey, marketPool(state))
        })
        play.act('BuyShares', {
            buyer: casey,
            certificateId: 'BA:share:2',
            expectedPrice: price(play.state)
        })
        expect(sharesOwned(play.state, 'BA', casey)).toBe(0)
        expect(openShorts(play.state, 'BA')).toEqual([])
        expect(play.state.certificates.find((c) => c.id === 'BA:share:2')?.retired).toBe(true)
    })
})

describe('dividends on shorts', () => {
    // BA has run for $60 and is about to pay; casey is short one share.
    function payout(caseyCash: number) {
        const play = playExample(EighteenSeventeenScenarios, 'routes', 3, (state) => {
            openShort(state, 'BA', casey, marketPool(state))
            setPlayerCash(state, 'casey', caseyCash)
            state.routeStep = {
                companyId: 'BA',
                result: { companyId: 'BA', routes: [], revenue: 60 }
            }
            state.machineState = 'DistributingEarnings'
        })
        play.act('DistributeEarnings', { companyId: 'BA', choice: 'pay' })
        return play
    }

    it('charges each short holder the dividend per share', () => {
        const play = payout(100)
        expect(cash(play.state, 'casey')).toBe(88)
        expect(play.state.machineState).toBe('BuyingTrains')
    })

    it('leaves a short holder who cannot pay in a cash crisis', () => {
        const play = payout(5)
        expect(cash(play.state, 'casey')).toBe(0)
        expect(play.state.machineState).toBe('RaisingCash')
        expect(play.state.cashCrisis).toEqual({
            debts: [{ playerId: 'casey', amount: 7 }],
            continuation: 'BuyingTrains'
        })
        play.act('GoBankrupt', {}, 'casey')
        expect(openShorts(play.state, 'BA')).toEqual([])
        expect(play.state.machineState).toBe('BuyingTrains')
    })
})

describe('the market’s shorts', () => {
    it('are closed at the next stock round with treasury shares the bank buys', () => {
        // The market holds a short of BA and none of its shares; BA's treasury holds one.
        const play = playExample(EighteenSeventeenScenarios, 'trading', 3, (state) => {
            const market = marketPool(state)
            const { shareId, shortId } = openShort(state, 'BA', market.owner, market)
            for (const certificate of state.certificates) {
                if (certificate.retired) continue
                if (certificate.id === shortId) certificate.poolId = market.id
                if (certificate.id === shareId || certificate.id === 'BA:share:2') {
                    certificate.owner = { kind: 'player', playerId: 'alex' }
                    delete certificate.poolId
                }
            }
        })
        const treasury = Number(cashOwnedBy(play.state, { kind: 'company', companyId: 'BA' }))
        expect(openShorts(play.state, 'BA')).toHaveLength(1)
        play.act('FinishStockTurn')
        expect(openShorts(play.state, 'BA')).toEqual([])
        expect(cashOwnedBy(play.state, { kind: 'company', companyId: 'BA' })).toBe(
            treasury + price(play.state)
        )
    })
})

describe('sold out and valuation', () => {
    it('moves a company held over 100% twice with Short Squeeze', () => {
        const play = playExample(EighteenSeventeenScenarios, 'trading', 3, (state) => {
            openShort(state, 'BA', casey, marketPool(state))
            for (const certificate of state.certificates)
                if (
                    !certificate.retired &&
                    certificate.kind === 'share' &&
                    certificate.companyId === 'BA' &&
                    certificate.owner.kind !== 'player'
                ) {
                    certificate.owner = { kind: 'player', playerId: 'alex' }
                    delete certificate.poolId
                }
        })
        expect(EighteenSeventeenStockRoundRules.soldOut(play.state, 'BA')).toBe(true)
        expect(EighteenSeventeenStockRoundRules.squeezed?.(play.state, 'BA')).toBe(false)
        expect(
            EighteenSeventeenStockRoundRules.squeezed?.({ ...play.state, shortSqueeze: true }, 'BA')
        ).toBe(true)
    })

    it('values a short at minus the share price', () => {
        const play = caseysTurn((state) => {
            openShort(state, 'BA', casey, marketPool(state))
        })
        const [short] = openShorts(play.state, 'BA')
        expect(EighteenSeventeenEndingRules.certificateItems(play.state, short)[0].value).toBe(
            -price(play.state)
        )
    })
})
