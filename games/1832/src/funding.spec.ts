import { describe, expect, it } from 'vitest'
import { EmergencyTrainFunding, cashOwnedBy, type FundingChoice } from '@tabletop/18xx'
import { playExample, type ExamplePlay } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoPhases,
    EighteenThirtyTwoStockRules,
    EighteenThirtyTwoTrainFundingRules,
    EighteenThirtyTwoTrainRules
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
    })

    it('ends the game at once when the president cannot raise the price', () => {
        const play = fundCheapestTrain('bankruptcy')
        expect(play.state.bankruptcy).toBeDefined()
        expect(play.state.machineState).toBe('GameOver')
        expect(play.state.result).toBeDefined()
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
