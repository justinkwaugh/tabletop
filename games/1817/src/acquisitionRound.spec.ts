import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    companyMarketSpace,
    finiteCashOwnedBy,
    getCompany,
    issueShareCertificates,
    loansOutstanding,
    openShort,
    placeStockMarker,
    sharesOwned,
    trainsOwnedBy,
    type EighteenXXState
} from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'
import { acquisitionRoundCompanyId, bidCeiling, bidRejection, isLiquidated } from './index.js'
import { mergerRoundCompanyId } from './mergerRound.js'
import { treasuryPoolId } from './roundRules.js'
import { marketPool } from './shorts.js'
import { activeAcquisitionRound } from './state.js'
import { EighteenSeventeenScenarios } from './scenarios/index.js'
import { passUntil } from '../test/passTurns.js'

const player = (playerId: string) => ({ kind: 'player' as const, playerId })
const company = (companyId: string) => ({ kind: 'company' as const, companyId })
const cash = (state: EighteenXXState, owner: Parameters<typeof finiteCashOwnedBy>[1]) =>
    finiteCashOwnedBy(state, owner)
const price = (state: EighteenXXState, companyId: string) =>
    companyMarketSpace(state.stockMarket, companyId).price

function setCash(state: EighteenXXState, companyId: string, amount: number) {
    const account = state.cash.find(
        (entry) => entry.owner.kind === 'company' && entry.owner.companyId === companyId
    )
    assertExists(account, 'The company holds cash')
    account.amount = amount
}

function giveTrains(state: EighteenXXState, companyId: string, count: number) {
    let given = 0
    state.trainInventory.trains = state.trainInventory.trains.map((train) => {
        if (given >= count || train.status !== 'depot' || train.definitionId !== '2') return train
        given++
        return { ...train, status: 'owned', owner: company(companyId) }
    })
}

/** PLE becomes a 5-share company with its three new shares in its treasury. */
function pleWithTreasury(state: EighteenXXState) {
    getCompany(state, 'PLE').shareCount = 5
    issueShareCertificates(state, 'PLE', 3, {
        owner: company('PLE'),
        poolId: treasuryPoolId('PLE')
    })
}

// BA (blair, 5 shares) and PLE (alex, 2 shares) finish their first operating turns without
// running, which leaves BA at $110 and PLE at $60; nobody converts or merges.
function acquisitionRound(prepare: (state: EighteenXXState) => void = () => {}) {
    const play = playExample(EighteenSeventeenScenarios, 'construction', 3, prepare)
    passUntil(play, (state) => state.machineState === 'MergerRound')
    while (play.state.machineState === 'MergerRound')
        play.act('PassMerger', { companyId: mergerRoundCompanyId(play.state) })
    return play
}

function finishAcquisition(play: ExamplePlay) {
    if (play.state.machineState === 'AcquisitionLoans')
        play.act('FinishAcquisitionLoans', {
            companyId: activeAcquisitionRound(play.state)?.acquisition?.buyerId
        })
}

describe('the acquisition round', () => {
    it('follows the merger round, offering the cheapest company first', () => {
        const play = acquisitionRound()
        expect(play.state.machineState).toBe('AcquisitionRound')
        expect(acquisitionRoundCompanyId(play.state)).toBe('PLE')
        expect(play.valid('alex')).toEqual(['OfferCompany', 'DeclineOffer'])
        play.act('DeclineOffer', { companyId: 'PLE' })
        expect(acquisitionRoundCompanyId(play.state)).toBe('BA')
        expect(play.valid('blair')).toEqual(['OfferCompany', 'DeclineOffer'])
        play.act('DeclineOffer', { companyId: 'BA' })
        expect(play.state.operatingSet?.roundNumber).toBe(2)
    })

    it('sells an offered company at its value, with the bank paying for its treasury', () => {
        const play = acquisitionRound(pleWithTreasury)
        const blair = cash(play.state, player('blair'))
        const alex = cash(play.state, player('alex'))
        play.act('OfferCompany', { companyId: 'PLE' })
        expect(play.state.machineState).toBe('AcquisitionBidding')
        expect(play.state.activePlayerIds).toEqual(['blair'])
        const sale = activeAcquisitionRound(play.state)?.sale
        assertExists(sale, 'A company is being sold')
        expect(bidRejection(play.state, sale, 'blair', 290)).toBe(
            'Bid at least 300, in steps of 10.'
        )
        play.act('BidToAcquire', { companyId: 'PLE', amount: 300 })
        expect(play.state.machineState).toBe('AcquisitionLoans')
        // The treasury's 3 shares at $60 and PLE's $100 more than cover the bid.
        expect(cash(play.state, company('BA'))).toBe(200 + 100 + 180 - 300)
        finishAcquisition(play)
        expect(cash(play.state, player('alex'))).toBe(alex + 2 * 60)
        expect(cash(play.state, player('blair'))).toBe(blair)
        expect(trainsOwnedBy(play.state, company('BA'))).toHaveLength(2)
        const ple = getCompany(play.state, 'PLE')
        expect(ple.started).toBeUndefined()
        expect(ple.shareCount).toBe(2)
    })

    it('has a buyer short of cash borrow, and moves it left for each loan it takes on', () => {
        const play = acquisitionRound((state) => {
            setCash(state, 'BA', 0)
            getCompany(state, 'PLE').loans = 2
        })
        expect(price(play.state, 'BA')).toBe(110)
        play.act('OfferCompany', { companyId: 'PLE' })
        play.act('BidToAcquire', { companyId: 'PLE', amount: 120 })
        expect(getCompany(play.state, 'BA').loans).toBe(3)
        expect(price(play.state, 'BA')).toBe(100)
        expect(play.valid('blair')).toEqual(['TakeLoan', 'FinishAcquisitionLoans'])
        finishAcquisition(play)
        expect(price(play.state, 'BA')).toBe(80)
    })

    it('lets the buyer repay the loans it takes on without moving its price', () => {
        const play = acquisitionRound((state) => {
            getCompany(state, 'PLE').loans = 1
        })
        play.act('OfferCompany', { companyId: 'PLE' })
        play.act('BidToAcquire', { companyId: 'PLE', amount: 120 })
        expect(play.valid('blair')).toEqual([
            'TakeLoan',
            'RepayAcquiredLoan',
            'FinishAcquisitionLoans'
        ])
        play.act('RepayAcquiredLoan', { companyId: 'BA' })
        // With nothing left to repay, and no borrowing after a repayment, the buyer is done.
        expect(play.state.machineState).not.toBe('AcquisitionLoans')
        expect(getCompany(play.state, 'BA').loans).toBeUndefined()
        expect(price(play.state, 'BA')).toBe(110)
    })

    it('charges a short holder the payment per share, as a cash crisis if need be', () => {
        const play = acquisitionRound((state) => {
            pleWithTreasury(state)
            openShort(state, 'PLE', player('casey'), marketPool(state))
            const account = state.cash.find(
                (entry) => entry.owner.kind === 'player' && entry.owner.playerId === 'casey'
            )
            assertExists(account, 'Casey holds cash')
            account.amount = 10
        })
        play.act('OfferCompany', { companyId: 'PLE' })
        play.act('BidToAcquire', { companyId: 'PLE', amount: 300 })
        finishAcquisition(play)
        expect(play.state.machineState).toBe('RaisingCash')
        expect(play.state.cashCrisis?.debts).toEqual([{ playerId: 'casey', amount: 50 }])
        // Bankruptcy settles the debt and the round carries on to its end, as nobody else could
        // buy Boston & Albany.
        play.act('GoBankrupt')
        expect(play.state.bankruptPlayerIds).toEqual(['casey'])
        expect(play.state.operatingSet?.roundNumber).toBe(2)
    })

    it('limits a company’s own president to the minimum bid', () => {
        const play = acquisitionRound((state) => {
            for (const certificate of state.certificates)
                if (
                    certificate.companyId === 'BA' &&
                    certificate.owner.kind === 'player' &&
                    certificate.owner.playerId === 'blair'
                )
                    certificate.owner = player('alex')
            getCompany(state, 'BA').president = player('alex')
            state.activePlayerIds = ['alex']
        })
        play.act('OfferCompany', { companyId: 'PLE' })
        expect(play.state.activePlayerIds).toEqual(['alex'])
        const sale = activeAcquisitionRound(play.state)?.sale
        assertExists(sale, 'A company is being sold')
        expect(bidRejection(play.state, sale, 'alex', 130)).toBe(
            'A company’s own president may bid only the minimum.'
        )
        expect(bidCeiling(play.state, sale, 'alex')).toBe(120)
        play.act('BidToAcquire', { companyId: 'PLE', amount: 120 })
        expect(sharesOwned(play.state, 'PLE', player('alex'))).toBe(2)
        finishAcquisition(play)
        expect(getCompany(play.state, 'PLE').started).toBeUndefined()
    })
})

describe('the closing zones', () => {
    it('auctions a company in the acquisition zone from $10, and keeps it if nobody bids', () => {
        const play = acquisitionRound((state) => placeStockMarker(state.stockMarket, 'PLE', '0:3'))
        expect(play.state.machineState).toBe('AcquisitionBidding')
        expect(play.state.activePlayerIds).toEqual(['blair'])
        play.act('PassOnCompany', { companyId: 'PLE' })
        expect(getCompany(play.state, 'PLE').floated).toBe(true)
    })

    it('sells a company in the acquisition zone to the only bidder', () => {
        const play = acquisitionRound((state) => placeStockMarker(state.stockMarket, 'PLE', '0:3'))
        const alex = cash(play.state, player('alex'))
        play.act('BidToAcquire', { companyId: 'PLE', amount: 10 })
        finishAcquisition(play)
        expect(cash(play.state, player('alex'))).toBe(alex + 2 * 5)
        expect(cash(play.state, company('BA'))).toBe(200 + 100 - 10)
    })

    it('has a liquidated company’s president pay what its sale leaves of its loans', () => {
        const play = acquisitionRound((state) => {
            pleWithTreasury(state)
            placeStockMarker(state.stockMarket, 'PLE', '0:0')
            getCompany(state, 'PLE').loans = 3
            // Its $15 interest on 3 loans leaves it $40.
            setCash(state, 'PLE', 55)
        })
        const alex = cash(play.state, player('alex'))
        // Its loans stay out of the bank until its sale settles them.
        expect(loansOutstanding(play.state)).toBe(3)
        play.act('BidToAcquire', { companyId: 'PLE', amount: 100 })
        finishAcquisition(play)
        expect(loansOutstanding(play.state)).toBe(0)
        expect(getCompany(play.state, 'BA').loans).toBeUndefined()
        expect(cash(play.state, company('BA'))).toBe(200 - 100)
        expect(cash(play.state, player('alex'))).toBe(alex - 160)
    })

    it('has the bank liquidate a company nobody buys', () => {
        const play = acquisitionRound((state) => {
            pleWithTreasury(state)
            placeStockMarker(state.stockMarket, 'PLE', '0:0')
            getCompany(state, 'PLE').loans = 3
            // Its $15 interest on 3 loans leaves it $40.
            setCash(state, 'PLE', 55)
        })
        const alex = cash(play.state, player('alex'))
        const [train] = trainsOwnedBy(play.state, company('PLE'))
        play.act('PassOnCompany', { companyId: 'PLE' })
        expect(cash(play.state, player('alex'))).toBe(alex - 260)
        expect(
            play.state.trainInventory.trains.find((entry) => entry.id === train.id)?.status
        ).toBe('removed')
        expect(play.state.stations.find((station) => station.id === 'PLE:home')?.status).toBe(
            'available'
        )
        expect(getCompany(play.state, 'PLE').started).toBeUndefined()
    })

    it('skips a company that entered a closing zone after its operating round', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3)
        passUntil(play, (state) => state.machineState === 'MergerRound')
        play.act('PassMerger', { companyId: 'BA' })
        placeStockMarker(play.state.stockMarket, 'PLE', '0:2')
        play.act('PassMerger', { companyId: 'PLE' })
        expect(play.state.operatingSet?.roundNumber).toBe(2)
        expect(getCompany(play.state, 'PLE').floated).toBe(true)
    })

    it('forgives the loans left by a liquidated company without a president', () => {
        const play = playExample(EighteenSeventeenScenarios, 'construction', 3, (state) => {
            placeStockMarker(state.stockMarket, 'PLE', '0:0')
            getCompany(state, 'PLE').loans = 2
            setCash(state, 'PLE', 20)
        })
        passUntil(play, (state) => state.machineState === 'MergerRound')
        const market = marketPool(play.state)
        for (const certificate of play.state.certificates)
            if (certificate.companyId === 'PLE' && certificate.kind === 'share') {
                certificate.owner = { ...market.owner }
                certificate.poolId = market.id
            }
        delete getCompany(play.state, 'PLE').president
        play.act('PassMerger', { companyId: 'BA' })
        const alex = cash(play.state, player('alex'))
        play.act('PassOnCompany', { companyId: 'PLE' })
        expect(cash(play.state, player('alex'))).toBe(alex)
        expect(play.state.cashCrisis).toBeUndefined()
        expect(loansOutstanding(play.state)).toBe(0)
    })
})

describe('the buyer', () => {
    it('discards trains over its limit before its loans', () => {
        const play = acquisitionRound((state) => giveTrains(state, 'PLE', 3))
        play.act('OfferCompany', { companyId: 'PLE' })
        play.act('BidToAcquire', { companyId: 'PLE', amount: 120 })
        expect(play.state.machineState).toBe('DiscardingMergedTrains')
        const [train] = trainsOwnedBy(play.state, company('BA'))
        play.act('DiscardMergedTrain', { companyId: 'BA', trainId: train.id })
        expect(play.state.machineState).toBe('AcquisitionLoans')
    })

    it('leaves the round when its loans push it into the acquisition zone', () => {
        const play = acquisitionRound((state) => {
            placeStockMarker(state.stockMarket, 'BA', '0:9')
            placeStockMarker(state.stockMarket, 'PLE', '0:7')
            setCash(state, 'BA', 0)
            getCompany(state, 'PLE').loans = 2
            setCash(state, 'PLE', 20)
        })
        play.act('OfferCompany', { companyId: 'PLE' })
        play.act('BidToAcquire', { companyId: 'PLE', amount: 300 })
        expect(isLiquidated(play.state.stockMarket, 'BA')).toBe(false)
        expect(companyMarketSpace(play.state.stockMarket, 'BA').id).toBe('0:3')
        // Boston & Albany is not offered after it falls into the zone.
        expect(play.state.operatingSet?.roundNumber).toBe(2)
    })
})
