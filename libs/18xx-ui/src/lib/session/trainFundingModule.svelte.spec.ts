import { describe, expect, it } from 'vitest'
import { TrainDepot, isFundTrain } from '@tabletop/18xx'
import {
    TestCompanyId,
    TestPlayerId,
    minimalPlayState,
    minimalStockRules,
    minimalTrainFundingRules,
    minimalTrainRules
} from '@tabletop/18xx/testing'
import { TrainFundingModule, type TrainFundingSession } from './trainFundingModule.svelte.js'
import { testSession } from './moduleTestSession.js'

function funding(
    machineState: TrainFundingSession['state']['machineState'],
    valid: string[],
    availability = {}
) {
    const state: TrainFundingSession['state'] = {
        ...minimalPlayState(),
        machineState,
        actionCount: 0,
        usedPrivatePowerIds: []
    }
    const rules: TrainFundingSession['rules'] = {
        stockRules: minimalStockRules,
        trainFundingRules: minimalTrainFundingRules,
        trainRules: minimalTrainRules
    }
    const harness = testSession(state, rules, valid, availability)
    return { ...harness, module: new TrainFundingModule(harness.session) }
}

const VariantDepot = new TrainDepot({
    id: 'variants',
    trains: [
        { id: '2', name: '2', price: 100, distance: { measure: 'revenue-centers', maximum: 2 } },
        { id: '3', name: '3', price: 150, distance: { measure: 'revenue-centers', maximum: 3 } }
    ],
    supply: [{ definitionId: '2', variantDefinitionIds: ['3'], count: 2 }]
})

function trainlessRailway() {
    const president = { kind: 'player' as const, playerId: TestPlayerId }
    const railway = { kind: 'company' as const, companyId: TestCompanyId }
    const base = minimalPlayState()
    const state: TrainFundingSession['state'] = {
        ...base,
        machineState: 'BuyingTrains',
        actionCount: 0,
        usedPrivatePowerIds: [],
        companies: [{ id: TestCompanyId, kind: 'major', president }],
        cash: [...base.cash, { owner: president, amount: 500 }, { owner: railway, amount: 0 }],
        certificates: [
            {
                id: `${TestCompanyId}:president`,
                companyId: TestCompanyId,
                kind: 'share',
                shares: 2,
                president: true,
                owner: president
            }
        ],
        trainInventory: VariantDepot.createInventory(),
        trainPurchaseStep: { companyId: TestCompanyId, purchasedTrainIds: [] },
        operatingSet: {
            number: 1,
            completed: false,
            roundNumber: 1,
            roundCount: 1,
            companyOrder: [TestCompanyId],
            completedCompanyIds: [],
            privateIncomePaid: false
        }
    }
    const rules: TrainFundingSession['rules'] = {
        stockRules: minimalStockRules,
        trainFundingRules: {
            ...minimalTrainFundingRules,
            contributors: () => [president],
            fundablePurchases: (_state, _companyId, offers) => [...offers]
        },
        trainRules: {
            ...minimalTrainRules,
            depot: VariantDepot,
            requiresTrain: () => true,
            availableDefinitions: () => ['2', '3']
        }
    }
    const harness = testSession(state, rules, ['FundTrain'])
    return { ...harness, module: new TrainFundingModule(harness.session) }
}

describe('TrainFundingModule', () => {
    it('offers every fundable train with its own plan, and funds the one chosen', async () => {
        const { module, applied } = trainlessRailway()
        expect(
            module.options.map(({ purchase, plan }) => [
                purchase.definitionId,
                plan.contributions.map((contribution) => contribution.amount)
            ])
        ).toEqual([
            ['2', [100]],
            ['3', [150]]
        ])
        const [, three] = module.options
        await module.choose(three.purchase)
        const [action] = applied
        expect(isFundTrain(action) && action.definitionId).toBe('3')
    })

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
        expect(funding('BuyingTrains', ['FundTrain'], { interactive: false }).module.canFund).toBe(
            false
        )
    })

    it('can resolve only while funding a train with some valid action', () => {
        expect(funding('FundingTrain', ['ContributeTrainFunds']).module.canResolve).toBe(true)
        expect(funding('FundingTrain', []).module.canResolve).toBe(false)
        expect(funding('FundingTrain', ['ExchangePrivateOutOfTurn']).module.canResolve).toBe(false)
        expect(
            funding('FundingTrain', ['DeclareBankruptcy', 'ExchangePrivate']).module.canResolve
        ).toBe(true)
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
