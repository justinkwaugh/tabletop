import { describe, expect, it } from 'vitest'
import { assert, assertExists } from '@tabletop/common'
import {
    EmergencyTrainFunding,
    cashOwnedBy,
    getCompany,
    isFundTrain,
    trainsOwnedBy,
    type FundingChoice
} from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoPhases,
    EighteenThirtyTwoStockRules,
    EighteenThirtyTwoTrainDepot,
    EighteenThirtyTwoTrainFundingRules,
    EighteenThirtyTwoTrainRules,
    formSystem
} from './index.js'
import { EighteenThirtyTwoScenarios } from './scenarios/index.js'

function funding(play: ExamplePlay) {
    return new EmergencyTrainFunding(
        play.state,
        EighteenThirtyTwoTrainFundingRules,
        EighteenThirtyTwoStockRules,
        EighteenThirtyTwoTrainRules
    )
}

function act(play: ExamplePlay, choice: FundingChoice) {
    switch (choice.kind) {
        case 'contribute':
            return play.act('ContributeTrainFunds', { owner: choice.owner, amount: choice.amount })
        case 'sell': {
            const sale = choice.sales.at(-1)!
            return play.act('SellFundingShares', {
                seller: choice.owner,
                companyId: sale.sales[0].companyId,
                shares: sale.sales[0].shares,
                expectedProceeds: sale.proceeds
            })
        }
        case 'buy':
            return play.act('BuyTrain', {
                companyId: choice.purchase.companyId,
                trainId: choice.purchase.trainId,
                definitionId: choice.purchase.definitionId,
                expectedPrice: choice.purchase.price
            })
        default:
            throw Error(`Unexpected funding choice ${choice.kind}`)
    }
}

function fundCheapestTrain(position: 'funding' | 'bankruptcy') {
    const play = playExample(EighteenThirtyTwoScenarios, position, 3)
    const purchase = funding(play).purchases()[0]
    expect(purchase.definitionId).toBe('4')
    play.act('FundTrain', {
        companyId: purchase.companyId,
        trainId: purchase.trainId,
        definitionId: purchase.definitionId,
        expectedPrice: purchase.price
    })
    for (let step = 0; play.state.trainFunding && !play.state.bankruptcy && step < 20; step++)
        act(play, funding(play).next())
    return play
}

describe('compulsory train purchases', () => {
    it('has the president contribute and sell shares, without losing the presidency', () => {
        const play = fundCheapestTrain('funding')
        expect(play.state.bankruptcy).toBeUndefined()
        expect(play.state.phaseId).toBe('4')
        expect(cashOwnedBy(play.state, { kind: 'company', companyId: 'CG' })).toBe(0)
        expect(play.state.companies.find((company) => company.id === 'CG')?.president).toEqual({
            kind: 'player',
            playerId: 'blair'
        })
        // Compulsory funding records nothing, as before voluntary funding existed.
        expect(play.processed.find(isFundTrain)?.metadata).toBeUndefined()
    })

    it('ends the game at once when the president cannot raise the price', () => {
        const play = fundCheapestTrain('bankruptcy')
        expect(play.state.bankruptcy).toBeDefined()
        expect(play.state.machineState).toBe('GameOver')
        expect(play.state.result).toBeDefined()
    })
})

describe('voluntary System train purchases', () => {
    const amtk = { kind: 'company' as const, companyId: 'AMTK' }

    // AMTK buys trains in phase 4, where a shell holds three, from the last two 4-trains.
    function systemBuyingTrains(trains: number, treasury: number, presidentCash: number) {
        const play = playExample(EighteenThirtyTwoScenarios, 'funding', 3)
        const state = structuredClone(play.state)
        state.phaseId = '4'
        formSystem(state, ['ACL', 'CG'], 'blair')
        const president = getCompany(state, 'AMTK').president
        assertExists(president, 'AMTK has a president')
        assertExists(state.operatingSet, 'The example is operating')
        state.operatingSet.companyOrder = ['AMTK']
        state.trainPurchaseStep = { companyId: 'AMTK', purchasedTrainIds: [] }
        for (let count = 0; count < trains; count++) {
            const train = EighteenThirtyTwoTrainDepot.nextTrain(state.trainInventory, '4')
            assertExists(train, 'The example requires a 4-train')
            EighteenThirtyTwoTrainDepot.purchase(state.trainInventory, train.id, '4', amtk)
        }
        for (const cash of state.cash) {
            if (cash.owner.kind === 'company' && cash.owner.companyId === 'AMTK')
                cash.amount = treasury
            if (president.kind === 'player' && cash.owner.kind === 'player')
                cash.amount = cash.owner.playerId === president.playerId ? presidentCash : 0
        }
        state.activePlayerIds = [president.kind === 'player' ? president.playerId : '']
        play.replaceState(state)
        return play
    }

    function fund(play: ExamplePlay) {
        const purchase = funding(play).purchases()[0]
        assertExists(purchase, 'The president may help')
        play.act('FundTrain', {
            companyId: purchase.companyId,
            trainId: purchase.trainId,
            definitionId: purchase.definitionId,
            expectedPrice: purchase.price
        })
        for (let step = 0; play.state.trainFunding && step < 5; step++)
            act(play, funding(play).next())
    }

    it('lets the president add cash for the cheapest train, with the whole treasury spent', () => {
        const play = systemBuyingTrains(1, 100, 600)
        const president = getCompany(play.state, 'AMTK').president!
        assert(president.kind === 'player')
        expect(play.valid(president.playerId)).toEqual(
            expect.arrayContaining(['FundTrain', 'FinishOperatingTurn'])
        )
        expect(
            funding(play)
                .purchases()
                .map((purchase) => purchase.price)
        ).toEqual([300])
        fund(play)
        expect(play.state.machineState).toBe('BuyingTrains')
        expect(trainsOwnedBy(play.state, amtk)).toHaveLength(2)
        expect(cashOwnedBy(play.state, amtk)).toBe(0)
        expect(cashOwnedBy(play.state, president)).toBe(400)
        expect(play.processed.find(isFundTrain)?.metadata).toEqual({
            voluntary: true
        })
    })

    it('helps again while the System holds no more than one shell’s limit', () => {
        const play = systemBuyingTrains(2, 100, 600)
        fund(play)
        expect(trainsOwnedBy(play.state, amtk)).toHaveLength(3)
        fund(play)
        expect(trainsOwnedBy(play.state, amtk)).toHaveLength(4)
        expect(cashOwnedBy(play.state, getCompany(play.state, 'AMTK').president!)).toBe(100)
    })

    it('offers no help beyond one shell’s limit', () => {
        expect(funding(systemBuyingTrains(4, 0, 1000)).purchases()).toEqual([])
    })

    it('offers no help when the System can pay alone', () => {
        expect(funding(systemBuyingTrains(1, 300, 1000)).purchases()).toEqual([])
    })

    it('offers no help when the president’s cash falls short, as no shares may be sold', () => {
        const play = systemBuyingTrains(1, 100, 199)
        expect(funding(play).purchases()).toEqual([])
        expect(play.valid(play.state.activePlayerIds[0])).not.toContain('FundTrain')
    })

    it('offers no help to a company that is not a System', () => {
        const play = playExample(EighteenThirtyTwoScenarios, 'funding', 3)
        const state = structuredClone(play.state)
        const train = EighteenThirtyTwoTrainDepot.nextTrain(state.trainInventory, '4')
        assertExists(train, 'The example requires a 4-train')
        EighteenThirtyTwoTrainDepot.purchase(state.trainInventory, train.id, '4', {
            kind: 'company',
            companyId: 'CG'
        })
        for (const cash of state.cash) if (cash.owner.kind === 'player') cash.amount = 1000
        play.replaceState(state)
        expect(funding(play).purchases()).toEqual([])
    })
})

describe('obsolescence', () => {
    it('scraps 2-, 3-, 4- and 5-trains with the first 4, 6, 8 and 12', () => {
        const rusts = (phaseId: string) =>
            ['2', '3', '4', '5'].filter((train) =>
                EighteenThirtyTwoPhases.rustTiming(phaseId, train)
            )
        expect(rusts('3')).toEqual([])
        expect(rusts('4')).toEqual(['2'])
        expect(rusts('6')).toEqual(['2', '3'])
        expect(rusts('8')).toEqual(['2', '3', '4'])
        expect(rusts('10')).toEqual(['2', '3', '4'])
        expect(rusts('12')).toEqual(['2', '3', '4', '5'])
    })
})
