import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    Definition as Top,
    TheOldPrinceTrainRules,
    TheOldPrincePhaseRules,
    TheOldPrinceTrackRules,
    TheOldPrinceCompanyRules
} from '@tabletop/the-old-prince'
import {
    Definition as Shikoku,
    Shikoku1889TrainRules,
    Shikoku1889PhaseRules,
    Shikoku1889TrackRules
} from '@tabletop/shikoku-1889'
import {
    TrainPurchase,
    discardableTrains,
    trainsOwnedBy,
    trainCanBeTraded,
    cashOwnedBy,
    type FinanceExampleState,
    type TrainRules
} from '@tabletop/18xx'
import { example } from './stockTestUtils.js'
const Titles = [
    {
        definition: Top,
        rules: TheOldPrinceTrainRules,
        phases: TheOldPrincePhaseRules,
        companyId: 'ML',
        rank: '2+',
        phase: '2+',
        discard: 'PEIR',
        destination: 'removed'
    },
    {
        definition: Shikoku,
        rules: Shikoku1889TrainRules,
        phases: Shikoku1889PhaseRules,
        companyId: 'IR',
        rank: '5',
        phase: '5',
        discard: 'IR',
        destination: 'market'
    }
]
function action(state: FinanceExampleState, type: string, fields: object = {}): GameAction {
    return {
        id: `${type}-${state.actionCount}`,
        gameId: state.gameId,
        type,
        source: ActionSource.User,
        playerId: state.activePlayerIds[0],
        ...fields
    }
}
function buy(
    state: FinanceExampleState,
    rules: TrainRules,
    rank: string,
    exchangeTrainId?: string
) {
    const companyId = state.trainPurchaseStep!.companyId,
        train = rules.depot.nextTrain(state.trainInventory, rank)!
    const request = {
        companyId,
        trainId: train.id,
        definitionId: rank,
        ...(exchangeTrainId ? { exchangeTrainId } : {})
    }
    const details = new TrainPurchase(state, rules).evaluate(request).details!
    expect(details).toBeDefined()
    return action(state, 'BuyTrain', { ...request, expectedPrice: details.price })
}
it.each(Titles)(
    'advances $definition.info.id immediately and resumes the original operator after ordered discards',
    ({ definition, rules, companyId, rank, phase, discard, destination }) => {
        const { game, engine, state } = example(definition, 'phases'),
            count = state.operatingSet!.roundCount
        const initial = structuredClone(state)
        const purchase = engine.executeCanonicalAction({
            game,
            state,
            action: buy(state, rules, rank)
        })
        expect(purchase.processedActions.map((a) => a.type)).toEqual(['BuyTrain', 'AdvancePhase'])
        let current = purchase.updatedState
        expect(current.phaseId).toBe(phase)
        expect(current.operatingSet!.roundCount).toBe(count)
        expect(current.phaseChange?.discardCompanyIds[0]).toBe(discard)
        expect(current.trainPurchaseStep?.companyId).toBe(companyId)
        expect(current.turnManager).toEqual(initial.turnManager)
        expect(current.phaseEvents).toHaveLength(1)
        const actions = [...purchase.processedActions],
            discarded: string[] = []
        while (current.phaseChange) {
            const id = current.phaseChange.discardCompanyIds[0],
                train = discardableTrains(current, id, rules)[0]
            expect(train).toBeDefined()
            const discard = action(current, 'DiscardTrain', { companyId: id, trainId: train.id })
            expect(() =>
                engine.executeCanonicalAction({
                    game,
                    state: current,
                    action: { ...discard, playerId: 'casey' }
                })
            ).toThrow()
            expect(
                engine.getValidActionTypesForPlayer(game, current, current.activePlayerIds[0])
            ).toEqual(['DiscardTrain'])
            const result = engine.executeCanonicalAction({ game, state: current, action: discard })
            actions.push(...result.processedActions)
            discarded.push(train.id)
            current = result.updatedState
            expect(current.trainInventory.trains.find((t) => t.id === train.id)?.status).toBe(
                destination
            )
        }
        expect(discarded).toHaveLength(definition === Top ? 1 : 2)
        expect(current.machineState).toBe(definition === Top ? 'BuyingTrains' : 'LayingTrack')
        let replay = state
        for (const a of actions) {
            replay = engine.applyProcessedAction({ game, state: replay, action: a })
            if (a.type === 'DiscardTrain' && !replay.phaseChange) {
                expect(replay.machineState).toBe('BuyingTrains')
                expect(replay.activePlayerIds).toEqual(initial.activePlayerIds)
                expect(replay.trainPurchaseStep!.purchasedTrainIds).toHaveLength(1)
                expect(replay.turnManager).toEqual(initial.turnManager)
            }
            expect(
                definition.runtime.hydrator
                    .hydrateState(JSON.parse(JSON.stringify(replay)))
                    .dehydrate()
            ).toEqual(replay)
        }
        expect(replay).toEqual(current)
        for (const a of [...actions].reverse())
            replay = engine.undoProcessedAction({ state: replay, action: a })
        expect(replay).toEqual(state)
        expect(state).toEqual(initial)
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state: current,
                action: purchase.processedActions[1]
            })
        ).toThrow()
        expect(() =>
            definition.runtime.hydrator
                .hydrateAction(purchase.processedActions[1])
                .apply(definition.runtime.hydrator.hydrateState(current))
        ).toThrow()
    }
)
it.each(Titles)(
    'rejects voluntary, stale, and wrong-company $definition.info.id discards',
    ({ definition, rules, rank }) => {
        const { game, engine, state } = example(definition, 'phases')
        const owned = state.trainInventory.trains.find((t) => t.status === 'owned')!
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state,
                action: action(state, 'DiscardTrain', {
                    companyId: state.trainPurchaseStep!.companyId,
                    trainId: owned.id
                })
            })
        ).toThrow()
        const current = engine.executeCanonicalAction({
            game,
            state,
            action: buy(state, rules, rank)
        }).updatedState
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state: current,
                action: action(current, 'DiscardTrain', { companyId: 'unknown', trainId: owned.id })
            })
        ).toThrow()
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state: current,
                action: action(current, 'DiscardTrain', {
                    companyId: current.phaseChange!.discardCompanyIds[0],
                    trainId: 'missing'
                })
            })
        ).toThrow()
    }
)
it('1889 exchanges a 4 at capacity for an 800 diesel and rusts the traded-in train', () => {
    const { game, engine, state } = example(Shikoku, 'diesel')
    const before = cashOwnedBy(state, { kind: 'company', companyId: 'IR' })
    const four = trainsOwnedBy(state, { kind: 'company', companyId: 'IR' }).find(
        (t) => t.definitionId === '4'
    )!
    const diesel = Shikoku1889TrainRules.depot.nextTrain(state.trainInventory, 'D')!
    expect(
        new TrainPurchase(state, Shikoku1889TrainRules).evaluate({
            companyId: 'IR',
            trainId: diesel.id,
            definitionId: 'D'
        }).reason
    ).toContain('train limit')
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: buy(state, Shikoku1889TrainRules, 'D', four.id)
    })
    expect(result.updatedState.phaseId).toBe('D')
    expect(cashOwnedBy(result.updatedState, { kind: 'company', companyId: 'IR' })).toBe(
        Number(before) - 800
    )
    expect(result.updatedState.trainInventory.trains.find((t) => t.id === four.id)?.status).toBe(
        'removed'
    )
    expect(result.updatedState.phaseEvents[0].rustedTrainIds).toContain(four.id)
    expect(result.updatedState.machineState).toBe('LayingTrack')
})
it('1889 preserves a traded 5 in the Market, and Market purchases preserve identity and prior use', () => {
    const { game, engine, state } = example(Shikoku, 'diesel')
    const five = trainsOwnedBy(state, { kind: 'company', companyId: 'IR' }).find(
        (t) => t.definitionId === '5'
    )!
    five.hasRun = true
    const current = engine.executeCanonicalAction({
        game,
        state,
        action: buy(state, Shikoku1889TrainRules, 'D', five.id)
    }).updatedState
    expect(current.trainInventory.trains.find((t) => t.id === five.id)).toMatchObject({
        status: 'market',
        hasRun: true
    })
    expect(trainsOwnedBy(current, { kind: 'company', companyId: 'IR' })).toHaveLength(1)
    const result = engine.executeCanonicalAction({
        game,
        state: current,
        action: action(current, 'BuyTrain', {
            companyId: 'IR',
            trainId: five.id,
            definitionId: '5',
            expectedPrice: 450
        })
    })
    expect(result.processedActions.map((a) => a.type)).toEqual([
        'BuyTrain',
        'FinishOperatingTurn',
        'StartOperatingTurn'
    ])
    expect(result.updatedState.trainInventory.trains.find((t) => t.id === five.id)).toMatchObject({
        status: 'owned',
        hasRun: true,
        owner: { kind: 'company', companyId: 'IR' }
    })
    expect(result.updatedState.phaseEvents).toHaveLength(1)
})
it('rejects an ordinary 1889 purchase at the old limit even when it would rust owned trains', () => {
    const { state } = example(Shikoku, 'trains')
    state.phaseId = '3'
    const inventory = state.trainInventory,
        rules = Shikoku1889TrainRules
    for (let i = 0; i < 3; i++) {
        const train = rules.depot.nextTrain(inventory, '2')!
        rules.depot.purchase(inventory, train.id, '2', { kind: 'company', companyId: 'IR' })
    }
    state.trainInventory.trains = inventory.trains.map((t) =>
        t.status === 'depot' && ['2', '3'].includes(t.definitionId)
            ? { id: t.id, definitionId: t.definitionId, status: 'removed' }
            : t
    )
    const train = rules.depot.nextTrain(inventory, '4')!
    expect(
        new TrainPurchase(state, rules).evaluate({
            companyId: 'IR',
            definitionId: '4',
            trainId: train.id
        }).reason
    ).toContain('train limit')
})
it.each([true, false])(
    'TOP gives an unused 4+ one operating opportunity (route submitted: %s), forbids trade, and then rusts it',
    (submitRoute) => {
        const { game, engine, state } = example(Top, 'diesel')
        const four = trainsOwnedBy(state, { kind: 'company', companyId: 'ML' })[0]
        const used = trainsOwnedBy(state, { kind: 'company', companyId: 'So' })[0]
        const current = engine.executeCanonicalAction({
            game,
            state,
            action: buy(state, TheOldPrinceTrainRules, 'D')
        }).updatedState
        expect(current.trainInventory.trains.find((t) => t.id === used.id)?.status).toBe('removed')
        const remaining = current.trainInventory.trains.find((t) => t.id === four.id)!
        expect(remaining).toMatchObject({ status: 'owned', rustsAfterOperation: true })
        expect(trainCanBeTraded(remaining)).toBe(false)
        delete current.trainPurchaseStep
        current.machineState = 'RunningTrains'
        current.routeStep = { companyId: 'ML' }
        const result = engine.executeCanonicalAction({
            game,
            state: current,
            action: action(current, 'RunTrains', {
                companyId: 'ML',
                routes: submitRoute
                    ? [
                          {
                              trainId: four.id,
                              start: { locationId: 'L16', nodeId: 'city' },
                              paths: [
                                  { locationId: 'L16', pathId: 'edge-5' },
                                  { locationId: 'M17', pathId: 'town-edge-2' }
                              ]
                          }
                      ]
                    : []
            })
        })
        expect(result.processedActions.map((a) => a.type)).toEqual(['RunTrains', 'RustTrains'])
        expect(
            result.updatedState.trainInventory.trains.find((t) => t.id === four.id)?.status
        ).toBe('removed')
        expect(result.updatedState.machineState).toBe('DistributingEarnings')
        expect(result.updatedState.routeStep!.result!.routes).toHaveLength(submitRoute ? 1 : 0)
        let replay = current
        for (const a of result.processedActions)
            replay = engine.applyProcessedAction({ game, state: replay, action: a })
        expect(replay).toEqual(result.updatedState)
        for (const a of [...result.processedActions].reverse())
            replay = engine.undoProcessedAction({ state: replay, action: a })
        expect(replay).toEqual(current)
    }
)
it('changes construction colors immediately and keeps TOP starting-price permissions phase-sensitive', () => {
    const { state } = example(Top, 'starting')
    state.phaseId = '3H'
    expect(TheOldPrinceTrackRules.availableColors(state)).toEqual(['yellow'])
    state.phaseId = '4H'
    expect(TheOldPrinceTrackRules.availableColors(state)).toEqual(['yellow', 'green'])
    const early = TheOldPrinceCompanyRules.startMarketSpaces(state, 'A')
    state.phaseId = '7'
    expect(TheOldPrinceCompanyRules.startMarketSpaces(state, 'A').length).toBeLessThan(early.length)
    state.phaseId = 'D'
    expect(TheOldPrinceTrackRules.availableColors(state)).toContain('gray')
    const shikoku = example(Shikoku, 'phases').state
    shikoku.phaseId = '5'
    expect(Shikoku1889TrackRules.availableColors(shikoku)).toContain('brown')
})
