import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    cashOwnedBy,
    companyMarketSpace,
    getCompany,
    issueShareCertificates,
    moveMarketSpace,
    openShort,
    openShorts,
    retireCertificates,
    sharesOwned,
    stockCertificateCount,
    type EighteenXXState
} from '@tabletop/18xx'
import { playExample } from '@tabletop/18xx/scenarios'
import { EighteenSeventeenEndingRules } from './endingRules.js'
import {
    EighteenSeventeenStockRoundRules,
    EighteenSeventeenStockRules,
    marketPool,
    shortReason
} from './index.js'
import { mergerRoundSubject } from './mergerRound.js'
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
    it('retires the bought share with the short, even at the certificate limit', () => {
        const play = caseysTurn((state) => {
            openShort(state, 'BA', casey, marketPool(state))
            const [heavy] = issueShareCertificates(state, 'PLE', 1, { owner: casey })
            for (const certificate of state.certificates)
                if (certificate.id === heavy) certificate.certificateLimitCount = 21
        })
        expect(stockCertificateCount(play.state, casey, EighteenSeventeenStockRules)).toBe(
            EighteenSeventeenStockRules.certificateLimit(play.state, casey)
        )
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
    // BA has run for $60 and is about to pay; each named player is short one share.
    function payout(choice: 'pay' | 'half-pay', shorts: Record<string, number>) {
        const play = playExample(EighteenSeventeenScenarios, 'routes', 3, (state) => {
            for (const certificate of state.certificates)
                if (certificate.id === 'BA:share:1') {
                    certificate.owner = { kind: 'bank' }
                    certificate.poolId = 'market'
                }
            for (const [playerId, amount] of Object.entries(shorts)) {
                openShort(state, 'BA', { kind: 'player', playerId }, marketPool(state))
                setPlayerCash(state, playerId, amount)
            }
            state.routeStep = {
                companyId: 'BA',
                result: { companyId: 'BA', routes: [], revenue: 60 }
            }
            state.machineState = 'DistributingEarnings'
        })
        play.act('DistributeEarnings', { companyId: 'BA', choice })
        return play
    }

    it('charges each short holder the dividend per share', () => {
        const play = payout('pay', { casey: 100 })
        expect(cash(play.state, 'casey')).toBe(88)
        expect(play.state.machineState).toBe('BuyingTrains')
    })

    it('charges half the dividend on a half pay', () => {
        const play = payout('half-pay', { casey: 100 })
        expect(cash(play.state, 'casey')).toBe(94)
    })

    it('queues the debts of short holders who cannot pay, from the president in turn order', () => {
        // Blair presides BA; turn order runs alex, blair, casey.
        const play = payout('pay', { alex: 0, casey: 5 })
        expect(cash(play.state, 'casey')).toBe(0)
        expect(play.state.machineState).toBe('RaisingCash')
        expect(play.state.cashCrisis).toEqual({
            debts: [
                { playerId: 'casey', amount: 7 },
                { playerId: 'alex', amount: 12 }
            ],
            continuation: 'BuyingTrains'
        })
        play.act('GoBankrupt', {}, 'casey')
        expect(play.state.activePlayerIds).toEqual(['alex'])
        play.act('GoBankrupt', {}, 'alex')
        expect(play.state.machineState).toBe('GameOver')
    })
})

describe('the market’s shorts', () => {
    // The market is short one BA share and holds none of its shares.
    function marketShort(state: EighteenXXState) {
        const market = marketPool(state)
        const { shareId, shortId } = openShort(state, 'BA', market.owner, market)
        retireCertificates(state, [shareId])
        for (const certificate of state.certificates) {
            if (certificate.retired) continue
            if (certificate.id === shortId) certificate.poolId = market.id
            if (certificate.id === 'BA:share:2') {
                certificate.owner = { kind: 'player', playerId: 'alex' }
                delete certificate.poolId
            }
        }
    }

    it('close against a share sold into the market', () => {
        const play = playExample(EighteenSeventeenScenarios, 'trading', 3, marketShort)
        play.act('SellShares', {
            seller: { kind: 'player', playerId: 'alex' },
            sales: [{ companyId: 'BA', shares: 1 }],
            expectedProceeds: price(play.state)
        })
        expect(openShorts(play.state, 'BA')).toEqual([])
    })

    it('stay open when a new short adds a market share', () => {
        const play = caseysTurn(marketShort)
        play.act('ShortShare', { companyId: 'BA', expectedPrice: price(play.state) })
        expect(openShorts(play.state, 'BA', marketPool(play.state).owner)).toHaveLength(1)
    })

    it('are bought out of the treasury by the bank as the next stock round begins', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, marketShort)
        const treasury = Number(cashOwnedBy(play.state, { kind: 'company', companyId: 'BA' }))
        for (let step = 0; step < 20 && play.state.machineState !== 'StockRound'; step++) {
            const actions = play.valid(play.state.activePlayerIds[0])
            const finish = [
                'FinishTrack',
                'FinishTrains',
                'FinishOperatingTurn',
                'PassMerger',
                'PassConvertedShares',
                'FinishConversionLoans'
            ].find((type) => actions.includes(type))
            assertExists(finish, `No way to finish in ${play.state.machineState}`)
            play.act(finish, {
                companyId:
                    play.state.trackStep?.companyId ??
                    play.state.loanStep?.companyId ??
                    play.state.trainPurchaseStep?.companyId ??
                    mergerRoundSubject(play.state)
            })
        }
        expect(play.state.machineState).toBe('StockRound')
        expect(openShorts(play.state, 'BA')).toEqual([])
        expect(cashOwnedBy(play.state, { kind: 'company', companyId: 'BA' })).toBe(
            treasury + price(play.state)
        )
    })
})

describe('the end of the stock round', () => {
    function finishRound(play: ReturnType<typeof caseysTurn>) {
        while (play.state.machineState === 'StockRound') play.act('FinishStockTurn')
    }

    it('drops a shorted company once more for the extra market share', () => {
        const play = caseysTurn()
        const before = companyMarketSpace(play.state.stockMarket, 'BA')
        play.act('ShortShare', { companyId: 'BA', expectedPrice: price(play.state) })
        finishRound(play)
        expect(companyMarketSpace(play.state.stockMarket, 'BA').id).toBe(
            moveMarketSpace(play.state.stockMarket, before.id, 'down', 2).id
        )
    })

    it('moves a company held over 100% up twice with Short Squeeze', () => {
        const play = playExample(EighteenSeventeenScenarios, 'trading', 3, (state) => {
            Object.assign(state, { shortSqueeze: true })
            // Blair and alex end up with three shares each, 120% between them.
            const { shareId } = openShort(state, 'BA', casey, marketPool(state))
            for (const certificate of state.certificates)
                if (
                    !certificate.retired &&
                    [shareId, 'BA:share:2', 'BA:share:3'].includes(certificate.id)
                ) {
                    certificate.owner = {
                        kind: 'player',
                        playerId: certificate.id === 'BA:share:2' ? 'blair' : 'alex'
                    }
                    delete certificate.poolId
                }
        })
        const before = companyMarketSpace(play.state.stockMarket, 'BA')
        finishRound(play)
        expect(companyMarketSpace(play.state.stockMarket, 'BA').id).toBe(
            moveMarketSpace(play.state.stockMarket, before.id, 'up', 2).id
        )
    })
})

describe('valuation', () => {
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
