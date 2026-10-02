import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    addCompanyStations,
    cashOwnedBy,
    companyMarketSpace,
    getCompany,
    issueShareCertificates,
    retireCertificates,
    sharesOwned,
    trainsOwnedBy,
    type EighteenXXState,
    type Train
} from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'
import { isLiquidated, stationsOverLimit, treasuryPoolId, trimStations } from './index.js'
import { mergerRoundCompanyId } from './mergerRound.js'
import { mergerRoundOf } from './state.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'
import { passUntil } from '../test/passTurns.js'

const player = (playerId: string) => ({ kind: 'player' as const, playerId })
const price = (state: EighteenXXState, companyId: string) =>
    companyMarketSpace(state.stockMarket, companyId).price
const treasury = (state: EighteenXXState, companyId: string) =>
    Number(cashOwnedBy(state, { kind: 'company', companyId }))
const stations = (state: EighteenXXState, companyId: string) =>
    state.stations.filter(
        (station) => station.companyId === companyId && station.status !== 'removed'
    ).length

function setCash(state: EighteenXXState, companyId: string, amount: number) {
    const account = state.cash.find(
        (cash) => cash.owner.kind === 'company' && cash.owner.companyId === companyId
    )
    assertExists(account, 'The company holds cash')
    account.amount = amount
}

/** PLE becomes a 5-share company whose treasury shares alex holds. */
function pleWithFiveShares(state: EighteenXXState) {
    getCompany(state, 'PLE').shareCount = 5
    issueShareCertificates(state, 'PLE', 3, { owner: player('alex') })
}

function giveTrains(state: EighteenXXState, companyId: string, count: number) {
    let given = 0
    state.trainInventory.trains = state.trainInventory.trains.map((train): Train => {
        if (given >= count || train.status !== 'depot' || train.definitionId !== '2') return train
        given++
        return { ...train, status: 'owned', owner: { kind: 'company', companyId } }
    })
}

// BA (blair, 5 shares) and PLE (alex, 2 shares) finish their first operating turns without
// running, which leaves BA at $110 and PLE at $60.
function mergerRound(prepare: (state: EighteenXXState) => void = () => {}) {
    const play = playExample(EighteenSeventeenScenarios, 'construction', 3, prepare)
    passUntil(play, (state) => state.machineState === 'MergerRound')
    return play
}

function passOn(play: ExamplePlay) {
    play.act('PassMerger', { companyId: mergerRoundCompanyId(play.state) })
}

describe('the merger round', () => {
    it('follows an operating round and offers each company in operating order', () => {
        const play = mergerRound()
        expect(mergerRoundCompanyId(play.state)).toBe('BA')
        expect(play.valid('blair')).toEqual(['ConvertCompany', 'PassMerger'])
        passOn(play)
        expect(mergerRoundCompanyId(play.state)).toBe('PLE')
        passOn(play)
        expect(play.state.operatingSet?.roundNumber).toBe(2)
        expect(play.state.machineState).toBe('LayingTrack')
    })

    it('passes straight on when no company can act', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
            getCompany(state, 'BA').shareCount = 10
            issueShareCertificates(state, 'BA', 5, { owner: player('casey') })
            getCompany(state, 'PLE').shareCount = 10
            issueShareCertificates(state, 'PLE', 8, { owner: player('blair') })
        })
        passUntil(play, (state) => state.operatingSet?.roundNumber === 2)
        expect(mergerRoundOf(play.state)?.completed).toBe(true)
        expect(play.state.machineState).toBe('LayingTrack')
    })
})

describe('conversion', () => {
    it('grows a 2-share company, sells its new shares, lends and buys its station', () => {
        const play = mergerRound()
        passOn(play)
        const cash = treasury(play.state, 'PLE')
        play.act('ConvertCompany', { companyId: 'PLE' })
        expect(getCompany(play.state, 'PLE').shareCount).toBe(5)
        expect(sharesOwned(play.state, 'PLE', player('alex'))).toBe(2)
        expect(play.state.machineState).toBe('TradingConvertedShares')
        expect(play.state.activePlayerIds).toEqual(['alex'])
        play.act('BuyConvertedShare', { companyId: 'PLE', expectedPrice: 60 })
        // At 60% the president can buy no more, so the turn moves on.
        expect(play.state.activePlayerIds).toEqual(['blair'])
        play.act('BuyConvertedShare', { companyId: 'PLE', expectedPrice: 60 })
        play.act('PassConvertedShares', { companyId: 'PLE' })
        expect(sharesOwned(play.state, 'PLE', player('alex'))).toBe(3)
        expect(sharesOwned(play.state, 'PLE', player('blair'))).toBe(1)
        expect(play.state.machineState).toBe('BorrowingAfterConversion')
        expect(treasury(play.state, 'PLE')).toBe(cash + 2 * 60)
        play.act('TakeLoan', { companyId: 'PLE' })
        expect(price(play.state, 'PLE')).toBe(55)
        play.act('FinishConversionLoans', { companyId: 'PLE' })
        expect(stations(play.state, 'PLE')).toBe(2)
        expect(treasury(play.state, 'PLE')).toBe(cash + 2 * 60 + 100 - 50)
        expect(play.state.operatingSet?.roundNumber).toBe(2)
    })

    it('liquidates a converted company that cannot pay for its stations', () => {
        const play = mergerRound((state) => {
            setCash(state, 'BA', 0)
        })
        play.act('ConvertCompany', { companyId: 'BA' })
        expect(getCompany(play.state, 'BA').shareCount).toBe(10)
        while (play.state.machineState === 'TradingConvertedShares')
            play.act('PassConvertedShares', { companyId: 'BA' })
        expect(play.state.machineState).toBe('BorrowingAfterConversion')
        play.act('FinishConversionLoans', { companyId: 'BA' })
        expect(isLiquidated(play.state.stockMarket, 'BA')).toBe(true)
        expect(mergerRoundCompanyId(play.state)).toBe('PLE')
    })
})

describe('mergers', () => {
    it('merges two 5-share companies at their average price under the largest holder', () => {
        const play = mergerRound(pleWithFiveShares)
        expect(play.valid('blair')).toEqual(['ConvertCompany', 'MergeCompanies', 'PassMerger'])
        play.act('MergeCompanies', { companyId: 'BA', targetId: 'PLE' })
        expect(getCompany(play.state, 'BA').shareCount).toBe(10)
        expect(price(play.state, 'BA')).toBe(80)
        expect(sharesOwned(play.state, 'BA', player('alex'))).toBe(6)
        expect(getCompany(play.state, 'BA').president).toEqual(player('alex'))
        expect(treasury(play.state, 'BA')).toBe(300)
        expect(trainsOwnedBy(play.state, { kind: 'company', companyId: 'BA' })).toHaveLength(2)
        expect(stations(play.state, 'BA')).toBe(3)
        const ple = getCompany(play.state, 'PLE')
        expect(ple.started).toBeUndefined()
        expect(ple.shareCount).toBe(2)
        expect(play.state.stations.find((station) => station.id === 'PLE:home')?.status).toBe(
            'available'
        )
        expect(play.state.machineState).toBe('TradingConvertedShares')
    })

    it('lets two 5-share companies merge once a player holds 40% of both together', () => {
        const play = mergerRound((state) => {
            getCompany(state, 'PLE').shareCount = 5
            issueShareCertificates(state, 'PLE', 3, {
                owner: { kind: 'company', companyId: 'PLE' },
                poolId: treasuryPoolId('PLE')
            })
        })
        expect(sharesOwned(play.state, 'PLE', player('alex'))).toBe(2)
        expect(sharesOwned(play.state, 'BA', player('alex'))).toBe(1)
        play.act('MergeCompanies', { companyId: 'BA', targetId: 'PLE' })
        expect(getCompany(play.state, 'BA').president).toEqual(player('alex'))
        expect(sharesOwned(play.state, 'BA', player('alex'))).toBe(3)
    })

    it('gives the survivor the target’s unplaced stations too', () => {
        const play = mergerRound((state) => {
            pleWithFiveShares(state)
            addCompanyStations(state, 'PLE', 1)
        })
        play.act('MergeCompanies', { companyId: 'BA', targetId: 'PLE' })
        expect(stations(play.state, 'BA')).toBe(4)
    })

    it('merges two 2-share companies at the sum of their prices, paid by the president', () => {
        const play = mergerRound((state) => {
            getCompany(state, 'BA').shareCount = 2
            retireCertificates(state, ['BA:share:1', 'BA:share:2', 'BA:share:3'])
        })
        play.act('MergeCompanies', { companyId: 'BA', targetId: 'PLE' })
        expect(price(play.state, 'BA')).toBe(165)
        expect(getCompany(play.state, 'BA').shareCount).toBe(5)
        expect(cashOwnedBy(play.state, player('blair'))).toBe(250 - 165)
        expect(sharesOwned(play.state, 'BA', player('alex'))).toBe(1)
        expect(
            play.state.certificates.filter(
                (certificate) => !certificate.retired && certificate.poolId === treasuryPoolId('BA')
            )
        ).toHaveLength(2)
    })

    it('has the merged company discard the trains over its limit', () => {
        const play = mergerRound((state) => {
            pleWithFiveShares(state)
            giveTrains(state, 'BA', 3)
        })
        play.act('MergeCompanies', { companyId: 'BA', targetId: 'PLE' })
        expect(play.state.machineState).toBe('DiscardingMergedTrains')
        expect(play.state.activePlayerIds).toEqual(['alex'])
        const [train] = trainsOwnedBy(play.state, { kind: 'company', companyId: 'BA' })
        play.act('DiscardMergedTrain', { companyId: 'BA', trainId: train.id })
        expect(trainsOwnedBy(play.state, { kind: 'company', companyId: 'BA' })).toHaveLength(4)
        expect(play.state.machineState).toBe('TradingConvertedShares')
    })

    it('removes unplaced stations over the limit before asking for placed ones', () => {
        const play = mergerRound()
        const state = structuredClone(play.state)
        addCompanyStations(state, 'BA', 8)
        expect(stationsOverLimit(state, 'BA')).toBe(2)
        trimStations(state, 'BA')
        expect(stationsOverLimit(state, 'BA')).toBe(0)
        expect(stations(state, 'BA')).toBe(8)
    })
})
