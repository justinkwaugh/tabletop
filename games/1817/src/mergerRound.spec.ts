import { EighteenSeventeenMarket } from './stockMarket.js'
import { describe, expect, it } from 'vitest'
import { assertExists, ActionSource } from '@tabletop/common'
import {
    addCompanyStations,
    cashOwnedBy,
    getCompany,
    issueShareCertificates,
    retireCertificates,
    sharesOwned,
    trainsOwnedBy,
    type EighteenXXState,
    type Train
} from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'
import {
    conversionPreview,
    isLiquidated,
    mergerPreview,
    treasuryShareIds,
    stationsForConversion,
    stationsOverLimit,
    treasuryPoolId,
    trimStations
} from './index.js'
import { mergerRoundCompanyId, convertedShareSales } from './mergerRound.js'
import { mergerRoundOf } from './state.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'
import { passUntil } from '../test/passTurns.js'

const player = (playerId: string) => ({ kind: 'player' as const, playerId })
const price = (state: EighteenXXState, companyId: string) =>
    EighteenSeventeenMarket.companySpace(state.stockMarket, companyId).price
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
        expect(play.state.machineState).toBe('AcquisitionRound')
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
        expect(play.state.machineState).toBe('AcquisitionRound')
    })

    it('offers a cashless shareholder a sale, then ends their turn without moving the price', () => {
        const play = mergerRound((state) => {
            const account = state.cash.find(
                (cash) => cash.owner.kind === 'player' && cash.owner.playerId === 'alex'
            )
            assertExists(account, 'Alex has an account')
            account.amount = 0
        })
        play.act('ConvertCompany', { companyId: 'BA' })
        expect(convertedShareSales(play.state, 'blair')).toEqual([])
        expect(() =>
            play.act('SellConvertedShares', { companyId: 'BA', shares: 1, expectedProceeds: 110 })
        ).toThrow()
        play.act('PassConvertedShares', { companyId: 'BA' })
        // Casey may buy before Alex in this seating order.
        while (play.state.activePlayerIds[0] !== 'alex')
            play.act('PassConvertedShares', { companyId: 'BA' })
        expect(play.valid('alex')).toEqual(['SellConvertedShares', 'PassConvertedShares'])
        const before = structuredClone(play.state)
        expect(() =>
            play.act('SellConvertedShares', { companyId: 'BA', shares: 1, expectedProceeds: 100 })
        ).toThrow()
        const result = play.engine.executeCanonicalAction({
            game: play.game,
            state: before,
            action: {
                id: 'converted-sale',
                gameId: play.game.id,
                source: ActionSource.User,
                playerId: 'alex',
                type: 'SellConvertedShares',
                companyId: 'BA',
                shares: 1,
                expectedProceeds: 110
            }
        })
        const sold = result.updatedState
        expect(sharesOwned(sold, 'BA', player('alex'))).toBe(0)
        expect(cashOwnedBy(sold, player('alex'))).toBe(110)
        expect(price(sold, 'BA')).toBe(110)
        expect(sold.activePlayerIds).not.toEqual(['alex'])
        let replay = before
        for (const action of result.processedActions)
            replay = play.engine.applyProcessedAction({ game: play.game, state: replay, action })
        expect(replay).toEqual(sold)
        let undone = sold
        for (const action of [...result.processedActions].reverse())
            undone = play.engine.undoProcessedAction({ state: undone, action })
        expect(undone).toEqual(before)
    })

    it('allows a shareholder to sell after a merger leaves no treasury shares', () => {
        const play = mergerRound((state) => {
            pleWithFiveShares(state)
            const certificate = state.certificates.find(
                (certificate) => certificate.poolId === treasuryPoolId('BA')
            )
            assertExists(certificate, 'BA has one treasury share')
            certificate.owner = player('blair')
            delete certificate.poolId
        })
        play.act('MergeCompanies', { companyId: 'BA', targetId: 'PLE' })
        expect(treasuryShareIds(play.state, 'BA')).toEqual([])
        // The president has nothing to buy and is automatically passed.
        expect(play.state.machineState).toBe('TradingConvertedShares')
        expect(play.valid('blair')).toContain('SellConvertedShares')
        expect(
            convertedShareSales(play.state, 'blair').map((sale) => sale.sales[0].shares)
        ).toEqual([1, 2, 3])
        play.act('SellConvertedShares', { companyId: 'BA', shares: 2, expectedProceeds: 160 })
        expect(sharesOwned(play.state, 'BA', player('blair'))).toBe(1)
        expect(play.state.activePlayerIds).not.toContain('blair')
        expect(play.state.machineState).toBe('BorrowingAfterConversion')
    })

    it('previews the shares and stations a conversion brings before the president converts', () => {
        const play = mergerRound()
        const preview = conversionPreview(play.state, 'BA')
        expect([preview.shareCount, preview.newShares]).toEqual([10, 5])
        play.act('ConvertCompany', { companyId: 'BA' })
        expect(stationsForConversion(play.state, 'BA')).toBe(preview.stations.stations)
        expect(conversionPreview(mergerRound().state, 'PLE')).toEqual({
            shareCount: 5,
            newShares: 3,
            stations: { stations: 1, cost: 50, affordable: true }
        })
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
                (certificate) => certificate.poolId === treasuryPoolId('BA')
            )
        ).toHaveLength(2)
    })

    it.each([
        [
            'two 2-share companies',
            (state: EighteenXXState) => {
                getCompany(state, 'BA').shareCount = 2
                retireCertificates(state, ['BA:share:1', 'BA:share:2', 'BA:share:3'])
            }
        ],
        [
            'two 5-share companies',
            (state: EighteenXXState) => {
                getCompany(state, 'PLE').shareCount = 5
                issueShareCertificates(state, 'PLE', 3, {
                    owner: { kind: 'company', companyId: 'PLE' },
                    poolId: treasuryPoolId('PLE')
                })
            }
        ]
    ])('previews what merging %s makes of the company', (_, prepare) => {
        const play = mergerRound(prepare)
        const preview = mergerPreview(play.state, 'BA', 'PLE')
        play.act('MergeCompanies', { companyId: 'BA', targetId: 'PLE' })
        expect(preview).toEqual({
            price: price(play.state, 'BA'),
            shareCount: getCompany(play.state, 'BA').shareCount,
            treasuryShares: treasuryShareIds(play.state, 'BA').length,
            stations: stations(play.state, 'BA')
        })
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
