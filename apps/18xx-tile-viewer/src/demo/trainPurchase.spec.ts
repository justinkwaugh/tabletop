import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { Definition as Top, TheOldPrinceTrainRules } from '@tabletop/the-old-prince'
import { Definition as Shikoku, Shikoku1889TrainRules } from '@tabletop/shikoku-1889'
import {
    TrainPurchase,
    trainsOwnedBy,
    cashOwnedBy,
    type TrainRules,
    type FinanceExampleState,
    type BuyTrain,
    type TrainPurchaseDetails
} from '@tabletop/18xx'
import { example } from './stockTestUtils.js'
const Titles = [
    {
        definition: Top,
        rules: TheOldPrinceTrainRules,
        companyId: 'ML',
        firstRank: '2H',
        nextRank: '3H'
    },
    {
        definition: Shikoku,
        rules: Shikoku1889TrainRules,
        companyId: 'IR',
        firstRank: '2',
        nextRank: '3'
    }
]
function firstPurchase(state: FinanceExampleState, rules: TrainRules): TrainPurchaseDetails {
    const result = new TrainPurchase(state, rules)
        .offers()
        .find((offer) => offer.evaluation.details)?.evaluation.details
    if (!result) throw new Error('Expected a legal train purchase')
    return result
}
function buy(state: FinanceExampleState, details: TrainPurchaseDetails): BuyTrain {
    return {
        id: `buy-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: 'BuyTrain',
        playerId: state.activePlayerIds[0],
        companyId: details.companyId,
        trainId: details.trainId,
        definitionId: details.definitionId,
        expectedPrice: details.price
    }
}
it.each(Titles)(
    'purchases $definition.info.id trains with correct cash, ownership, supply, replay and Undo',
    ({ definition, rules, companyId, firstRank }) => {
        const { game, engine, state } = example(definition, 'trains')
        const before = structuredClone(state)
        const details = firstPurchase(state, rules)
        expect(details.definitionId).toBe(firstRank)
        expect(details.price).toBe(80)
        expect(state).toEqual(before)
        const action = buy(state, details)
        const result = engine.executeCanonicalAction({ game, state, action })
        expect(result.processedActions.map((action) => action.type)).toEqual(['BuyTrain'])
        expect(trainsOwnedBy(result.updatedState, { kind: 'company', companyId })).toHaveLength(2)
        expect(cashOwnedBy(result.updatedState, { kind: 'company', companyId })).toBe(
            Number(cashOwnedBy(state, { kind: 'company', companyId })) - 80
        )
        const bank = cashOwnedBy(state, { kind: 'bank' })
        expect(cashOwnedBy(result.updatedState, { kind: 'bank' })).toBe(
            bank === 'unlimited' ? bank : Number(bank) + 80
        )
        expect(result.updatedState.trainPurchaseStep?.purchasedTrainIds).toEqual([details.trainId])
        expect(rules.depot.remaining(result.updatedState.trainInventory, firstRank)).toBe(
            Number(rules.depot.remaining(state.trainInventory, firstRank)) - 1
        )
        expect(result.updatedState.phaseId).toBe(state.phaseId)
        expect(
            engine.applyProcessedAction({ game, state, action: result.processedActions[0] })
        ).toEqual(result.updatedState)
        expect(
            engine.undoProcessedAction({
                state: result.updatedState,
                action: result.processedActions[0]
            })
        ).toEqual(state)
        expect(definition.runtime.hydrator.hydrateState(result.updatedState).dehydrate()).toEqual(
            result.updatedState
        )
        expect(engine.executeCanonicalAction({ game, state, action }).updatedState).toEqual(
            result.updatedState
        )
        expect(() =>
            engine.executeCanonicalAction({ game, state: result.updatedState, action })
        ).toThrow()
        const wrongPrice: BuyTrain = { ...action, expectedPrice: 1 }
        expect(() => engine.executeCanonicalAction({ game, state, action: wrongPrice })).toThrow()
        expect(() =>
            engine.executeCanonicalAction({ game, state, action: { ...action, playerId: 'casey' } })
        ).toThrow()
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state,
                action: { ...action, source: ActionSource.System }
            })
        ).toThrow()
    }
)
it.each(Titles)(
    'enforces $definition.info.id affordability and current limits before a phase change',
    ({ definition, rules, companyId, firstRank, nextRank }) => {
        const { state } = example(definition, 'trains')
        const details = firstPurchase(state, rules)
        const cash = state.cash.find(
            (cash) => cash.owner.kind === 'company' && cash.owner.companyId === companyId
        )!
        cash.amount = 79
        expect(new TrainPurchase(state, rules).evaluate(details).reason).toContain('afford')
        cash.amount = 10000
        while (rules.depot.nextTrain(state.trainInventory, firstRank)) {
            const train = rules.depot.nextTrain(state.trainInventory, firstRank)!
            rules.depot.purchase(state.trainInventory, train.id, train.definitionId, {
                kind: 'company',
                companyId
            })
        }
        const next = rules.depot.nextTrain(state.trainInventory, nextRank)!
        const request = { companyId, trainId: next.id, definitionId: next.definitionId }
        expect(new TrainPurchase(state, rules).evaluate(request).reason).toContain('train limit')
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            train.status === 'owned'
                ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
                : train
        )
        expect(new TrainPurchase(state, rules).evaluate(request).details).toBeDefined()
    }
)
it('limits PEIR to one depot purchase per operating round', () => {
    const { game, engine, state } = example(Top, 'trains')
    state.trainPurchaseStep = { companyId: 'PEIR', purchasedTrainIds: [] }
    state.activePlayerIds = ['blair']
    const details = firstPurchase(state, TheOldPrinceTrainRules)
    const result = engine.executeCanonicalAction({ game, state, action: buy(state, details) })
    expect(
        new TrainPurchase(result.updatedState, TheOldPrinceTrainRules)
            .offers()
            .find((offer) => offer.definitionId === '2H')?.evaluation.reason
    ).toContain('allowance')
    expect(result.updatedState.trainPurchaseStep?.purchasedTrainIds).toHaveLength(1)
})
it.each(Titles)(
    'purchases unlimited $definition.info.id diesels with deterministic identity and undo',
    ({ definition, rules, companyId }) => {
        const { game, engine, state } = example(definition, 'trains')
        state.phaseId = 'D'
        if (definition === Top) state.gameEnding = { reason: 'First diesel', finalOperatingSet: 2 }
        state.trainInventory.trains = state.trainInventory.trains.map((train) => ({
            id: train.id,
            definitionId: train.definitionId,
            status: 'removed'
        }))
        state.cash.find(
            (cash) => cash.owner.kind === 'company' && cash.owner.companyId === companyId
        )!.amount = 3000
        const details = firstPurchase(state, rules)
        expect(details.definitionId).toBe('D')
        const result = engine.executeCanonicalAction({ game, state, action: buy(state, details) })
        const next = firstPurchase(result.updatedState, rules)
        expect(next.trainId).not.toBe(details.trainId)
        expect(rules.depot.remaining(result.updatedState.trainInventory, 'D')).toBe('unlimited')
        expect(
            engine.undoProcessedAction({
                state: result.updatedState,
                action: result.processedActions[0]
            })
        ).toEqual(state)
        expect(
            engine.executeCanonicalAction({ game, state, action: buy(state, details) }).updatedState
        ).toEqual(result.updatedState)
    }
)
it('makes 1889 diesels available alongside remaining 6 trains, at their ordinary price', () => {
    const { state } = example(Shikoku, 'trains')
    state.phaseId = '6'
    state.cash.find(
        (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'IR'
    )!.amount = 1500
    state.trainInventory.trains = state.trainInventory.trains.map((train) =>
        ['2', '3', '4', '5'].includes(train.definitionId)
            ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
            : train
    )
    expect(Shikoku1889TrainRules.availableDefinitions(state)).toEqual(['6', 'D'])
    expect(
        new TrainPurchase(state, Shikoku1889TrainRules)
            .offers()
            .find((offer) => offer.definitionId === 'D')?.evaluation.details?.price
    ).toBe(1100)
})
it('distinguishes TOP hex-edge and city/offboard limits from 1889 revenue-center limits', () => {
    expect(TheOldPrinceTrainRules.depot.trainDefinition('6H').distance).toEqual({
        measure: 'hex-edges',
        maximum: 6
    })
    expect(TheOldPrinceTrainRules.depot.trainDefinition('3+').distance).toEqual({
        measure: 'cities-and-offboards',
        maximum: 3
    })
    expect(Shikoku1889TrainRules.depot.trainDefinition('3').distance).toEqual({
        measure: 'revenue-centers',
        maximum: 3
    })
})
