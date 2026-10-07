import { describe, expect, it } from 'vitest'
import {
    EmergencyTrainFunding,
    cashOwnedBy,
    companyMarketSpace,
    evaluateShareSale,
    getCompany,
    placeStockMarker,
    sharesOwned
} from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoStockRules,
    EighteenThirtyTwoTrainFundingRules,
    EighteenThirtyTwoTrainRules,
    type EighteenThirtyTwoState
} from './index.js'
import { EighteenThirtyTwoScenarios } from './scenarios/index.js'

type Play = ExamplePlay<EighteenThirtyTwoState>
const player = (playerId: string) => ({ kind: 'player' as const, playerId })

function sell(play: Play, companyId: string, shares: number) {
    const playerId = play.state.activePlayerIds[0]
    const request = { playerId, seller: player(playerId), sales: [{ companyId, shares }] }
    const { details } = evaluateShareSale(play.state, request, EighteenThirtyTwoStockRules)
    expect(details).toBeDefined()
    play.act('SellShares', { ...request, expectedProceeds: details!.proceeds })
    return details!.proceeds
}

function setPlayerCash(state: EighteenThirtyTwoState, playerId: string, amount: number) {
    const cash = state.cash.find(
        (entry) => entry.owner.kind === 'player' && entry.owner.playerId === playerId
    )
    cash!.amount = amount
}

function giveOfferingShares(
    state: EighteenThirtyTwoState,
    companyId: string,
    playerId: string,
    count: number
) {
    for (const certificate of state.certificates) {
        if (count === 0) return
        if (
            certificate.retired ||
            certificate.companyId !== companyId ||
            certificate.poolId !== 'initial-offering'
        )
            continue
        certificate.owner = player(playerId)
        delete certificate.poolId
        count--
    }
}

function trading(prepare: (state: EighteenThirtyTwoState) => void = () => {}) {
    return playExample(EighteenThirtyTwoScenarios, 'trading', 3, prepare)
}

describe('share price protection', () => {
    it('lets the president buy back a stock-round sale, restoring the price', () => {
        const play = trading()
        const proceeds = sell(play, 'CG', 2)
        expect(companyMarketSpace(play.state.stockMarket, 'CG').id).toBe('2:6')
        expect(play.state.machineState).toBe('StockRound')
        play.act('FinishStockTurn')
        expect(play.state.machineState).toBe('ProtectingPrice')
        expect(play.state.activePlayerIds).toEqual(['blair'])
        expect(play.valid('blair')).toEqual(['ProtectShares', 'DeclineProtection'])
        play.act('ProtectShares', { companyId: 'CG' }, 'blair')
        expect(play.state.machineState).toBe('StockRound')
        expect(companyMarketSpace(play.state.stockMarket, 'CG').id).toBe('0:6')
        expect(sharesOwned(play.state, 'CG', player('blair'))).toBe(5)
        expect(cashOwnedBy(play.state, player('blair'))).toBe(450 - proceeds)
        expect(cashOwnedBy(play.state, player('alex'))).toBe(600 + proceeds)
        // Play resumes to the left of the protecting president (§5.9.6).
        expect(play.state.activePlayerIds).toEqual(['casey'])
        expect(play.state.turnManager.series.at(-1)?.playerId).toBe('casey')
        expect(play.state.priceProtection).toBeUndefined()
    })

    it('resumes with the next player when the president declines', () => {
        const play = trading()
        sell(play, 'CG', 2)
        play.act('FinishStockTurn')
        play.act('DeclineProtection', { companyId: 'CG' }, 'blair')
        expect(play.state.machineState).toBe('StockRound')
        expect(play.state.activePlayerIds).toEqual(['blair'])
        expect(companyMarketSpace(play.state.stockMarket, 'CG').id).toBe('2:6')
        expect(sharesOwned(play.state, 'CG', player('blair'))).toBe(3)
    })

    it('offers nothing for a seller’s sale of their own company', () => {
        const play = trading()
        sell(play, 'ACL', 1)
        play.act('FinishStockTurn')
        expect(play.state.machineState).toBe('StockRound')
        expect(play.state.activePlayerIds).toEqual(['blair'])
        expect(play.state.priceProtection).toBeUndefined()
    })

    it('needs the cash to buy every share sold', () => {
        const play = trading((state) => setPlayerCash(state, 'blair', 150))
        sell(play, 'CG', 2)
        play.act('FinishStockTurn')
        expect(play.state.machineState).toBe('StockRound')
        expect(play.state.activePlayerIds).toEqual(['blair'])
    })

    it('lets a protecting president exceed 60% until they next sell', () => {
        const play = trading((state) => giveOfferingShares(state, 'CG', 'blair', 2))
        sell(play, 'CG', 3)
        play.act('FinishStockTurn')
        play.act('ProtectShares', { companyId: 'CG' }, 'blair')
        expect(sharesOwned(play.state, 'CG', player('blair'))).toBe(8)
        expect(play.state.ownershipLimitExemptions).toEqual([
            { owner: player('blair'), companyId: 'CG', maximumShares: 8 }
        ])
        play.act('FinishStockTurn', {}, 'casey')
        play.act('FinishStockTurn', {}, 'alex')
        expect(play.state.activePlayerIds).toEqual(['blair'])
        sell(play, 'CG', 1)
        expect(play.state.ownershipLimitExemptions).toEqual([])
        // Out of the green and brown areas, they must now sell down to 60% (§5.9.8).
        expect(play.valid('blair')).toContain('SellShares')
        expect(() => play.act('FinishStockTurn')).toThrow()
    })

    it('decides sales in the order sold, resuming left of the last protector', () => {
        const caseyHoldsCG = (state: EighteenThirtyTwoState) =>
            giveOfferingShares(state, 'CG', 'casey', 1)
        const caseySells = () => {
            const play = trading(caseyHoldsCG)
            play.act('FinishStockTurn')
            play.act('FinishStockTurn')
            sell(play, 'ACL', 1)
            // With nothing left to buy, casey's turn ends with the second sale.
            sell(play, 'CG', 1)
            expect(play.state.activePlayerIds).toEqual(['alex'])
            expect(play.valid('alex')).toEqual(['ProtectShares', 'DeclineProtection'])
            return play
        }
        const both = caseySells()
        both.act('ProtectShares', { companyId: 'ACL' }, 'alex')
        both.act('ProtectShares', { companyId: 'CG' }, 'blair')
        // Casey's resumed turn, with nothing to buy, ends at once.
        expect(both.state.turnManager.series.slice(-2).map((turn) => turn.playerId)).toEqual([
            'casey',
            'alex'
        ])

        const first = caseySells()
        first.act('ProtectShares', { companyId: 'ACL' }, 'alex')
        first.act('DeclineProtection', { companyId: 'CG' }, 'blair')
        expect(first.state.activePlayerIds).toEqual(['blair'])
    })

    it('returns to the operating turn after protecting a forced sale', () => {
        const play = playExample(EighteenThirtyTwoScenarios, 'funding', 3, (state) =>
            setPlayerCash(state, 'alex', 300)
        )
        const funding = () =>
            new EmergencyTrainFunding(
                play.state,
                EighteenThirtyTwoTrainFundingRules,
                EighteenThirtyTwoStockRules,
                EighteenThirtyTwoTrainRules
            )
        const purchase = funding().purchases()[0]
        play.act('FundTrain', {
            companyId: purchase.companyId,
            trainId: purchase.trainId,
            definitionId: purchase.definitionId,
            expectedPrice: purchase.price
        })
        play.act('SellFundingShares', {
            seller: player('blair'),
            companyId: 'ACL',
            shares: 1,
            expectedProceeds: companyMarketSpace(play.state.stockMarket, 'ACL').price
        })
        for (let step = 0; play.state.trainFunding && step < 10; step++) {
            const choice = funding().next()
            if (choice.kind === 'contribute')
                play.act('ContributeTrainFunds', { owner: choice.owner, amount: choice.amount })
            else if (choice.kind === 'buy')
                play.act('BuyTrain', {
                    companyId: choice.purchase.companyId,
                    trainId: choice.purchase.trainId,
                    definitionId: choice.purchase.definitionId,
                    expectedPrice: choice.purchase.price
                })
            else if (choice.kind === 'sell') {
                const sale = choice.sales.at(-1)!
                play.act('SellFundingShares', {
                    seller: choice.owner,
                    companyId: sale.sales[0].companyId,
                    shares: sale.sales[0].shares,
                    expectedProceeds: sale.proceeds
                })
            } else throw Error(`Unexpected funding choice ${choice.kind}`)
        }
        expect(play.state.machineState).toBe('ProtectingPrice')
        expect(play.state.activePlayerIds).toEqual(['alex'])
        const aclSpace = play.state.priceProtection?.sales[0].fromMarketSpaceId
        play.act('ProtectShares', { companyId: 'ACL' }, 'alex')
        expect(companyMarketSpace(play.state.stockMarket, 'ACL').id).toBe(aclSpace)
        // CG's turn, with nothing left to do, ends and play moves on to the next company.
        expect(play.state.priceProtection).toBeUndefined()
        expect(play.state.operatingSet?.completedCompanyIds).toContain('CG')
        expect(play.state.machineState).toBe('LayingTrack')
    })
})

describe('black-area closure', () => {
    it('closes a company its own president sells into the black area at once', () => {
        const play = trading((state) => placeStockMarker(state.stockMarket, 'ACL', '8:1'))
        sell(play, 'ACL', 1)
        const acl = getCompany(play.state, 'ACL')
        expect(acl.closed).toBe(true)
        expect(acl.president).toBeUndefined()
        expect(sharesOwned(play.state, 'ACL', player('alex'))).toBe(0)
        expect(
            play.state.stockMarket.stacks.some((stack) => stack.companyIds.includes('ACL'))
        ).toBe(false)
        expect(
            play.state.stations
                .filter((station) => station.companyId === 'ACL')
                .every((station) => station.status === 'removed')
        ).toBe(true)
        expect(play.state.machineState).toBe('StockRound')
        expect(play.state.activePlayerIds).toEqual(['alex'])
    })

    it('waits for the president’s protection decision before closing', () => {
        const declined = trading((state) => placeStockMarker(state.stockMarket, 'CG', '8:1'))
        sell(declined, 'CG', 1)
        expect(getCompany(declined.state, 'CG').closed).toBeFalsy()
        declined.act('FinishStockTurn')
        declined.act('DeclineProtection', { companyId: 'CG' }, 'blair')
        expect(getCompany(declined.state, 'CG').closed).toBe(true)
        expect(declined.state.activePlayerIds).toEqual(['blair'])

        const protectedPlay = trading((state) => placeStockMarker(state.stockMarket, 'CG', '8:1'))
        sell(protectedPlay, 'CG', 1)
        protectedPlay.act('FinishStockTurn')
        protectedPlay.act('ProtectShares', { companyId: 'CG' }, 'blair')
        expect(getCompany(protectedPlay.state, 'CG').closed).toBeFalsy()
        expect(companyMarketSpace(protectedPlay.state.stockMarket, 'CG').id).toBe('8:1')
    })

    it('forfeits the president’s cash when funding sales close their own company', () => {
        const play = playExample(EighteenThirtyTwoScenarios, 'funding', 3, (state) =>
            placeStockMarker(state.stockMarket, 'CG', '8:1')
        )
        const purchase = new EmergencyTrainFunding(
            play.state,
            EighteenThirtyTwoTrainFundingRules,
            EighteenThirtyTwoStockRules,
            EighteenThirtyTwoTrainRules
        ).purchases()[0]
        play.act('FundTrain', {
            companyId: purchase.companyId,
            trainId: purchase.trainId,
            definitionId: purchase.definitionId,
            expectedPrice: purchase.price
        })
        play.act('SellFundingShares', {
            seller: player('blair'),
            companyId: 'CG',
            shares: 1,
            expectedProceeds: 10
        })
        expect(getCompany(play.state, 'CG').closed).toBe(true)
        expect(cashOwnedBy(play.state, player('blair'))).toBe(0)
        expect(play.state.trainFunding).toBeUndefined()
        expect(play.state.operatingSet?.completedCompanyIds).toContain('CG')
        expect(play.state.machineState).not.toBe('FundingTrain')
    })
})
