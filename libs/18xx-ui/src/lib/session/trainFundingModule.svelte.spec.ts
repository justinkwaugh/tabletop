import { describe, expect, it } from 'vitest'
import {
    minimalPlayState,
    minimalStockRules,
    minimalTrainFundingRules,
    minimalTrainRules
} from '@tabletop/18xx/testing'
import { TrainFundingModule, type TrainFundingContext } from './trainFundingModule.svelte.js'
import { testContext } from './moduleTestContext.js'

function funding(
    machineState: TrainFundingContext['state']['machineState'],
    valid: string[],
    availability = {}
) {
    const state: TrainFundingContext['state'] = {
        ...minimalPlayState(),
        machineState,
        actionCount: 0,
        usedPrivatePowerIds: []
    }
    const rules: TrainFundingContext['rules'] = {
        stockRules: minimalStockRules,
        trainFundingRules: minimalTrainFundingRules,
        trainRules: minimalTrainRules
    }
    const harness = testContext(state, rules, valid, availability)
    return { ...harness, module: new TrainFundingModule(harness.context) }
}

describe('TrainFundingModule', () => {
    it('offers no funded purchases or choice outside their machine states', () => {
        const { module } = funding('StockRound', [])
        expect(module.purchases).toEqual([])
        expect(module.choice).toBeUndefined()
        expect(module.purchase).toBeUndefined()
        expect(module.plan).toBeUndefined()
        expect(module.sales).toEqual([])
    })

    it('can start funding only when the action is valid and the session is interactive', () => {
        expect(funding('BuyingTrains', ['FundTrain']).module.canFund).toBe(true)
        expect(funding('BuyingTrains', ['BuyTrain']).module.canFund).toBe(false)
        expect(funding('BuyingTrains', ['FundTrain'], { interactive: false }).module.canFund).toBe(false)
    })

    it('can resolve only while funding a train with some valid action', () => {
        expect(funding('FundingTrain', ['ContributeTrainFunds']).module.canResolve).toBe(true)
        expect(funding('FundingTrain', []).module.canResolve).toBe(false)
        expect(funding('BuyingTrains', ['FundTrain']).module.canResolve).toBe(false)
    })

    it('reports no funding history when no funding is in progress', () => {
        const { module } = funding('BuyingTrains', ['FundTrain'])
        expect(module.contributions).toEqual([])
        expect(module.saleHistory).toEqual([])
    })

    it('refuses to fund when funding is unavailable', async () => {
        const { module } = funding('StockRound', [])
        await expect(module.resolve()).rejects.toThrow('Funding requires a train')
    })
})
