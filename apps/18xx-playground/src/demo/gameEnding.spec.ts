import { expect, it } from 'vitest'
import {
    ActionSource,
    GameResult,
    assertExists,
    validateGameResult,
    type GameAction
} from '@tabletop/common'
import {
    Definition as Top,
    TheOldPrinceEndingRules,
    TheOldPrinceTrainRules
} from '@tabletop/the-old-prince'
import { Definition as Shikoku, Shikoku1889EndingRules } from '@tabletop/shikoku-1889'
import {
    finalWealth,
    cashOwnedBy,
    settleCashPayments,
    TrainPurchase,
    type EighteenXXState
} from '@tabletop/18xx'
import { example, purchase } from './stockTestUtils.js'
function action(
    state: EighteenXXState,
    type: string,
    fields: object = {},
    source = ActionSource.User
): GameAction {
    return {
        id: `${type}:${state.actionCount}`,
        gameId: state.gameId,
        source,
        type,
        playerId: state.activePlayerIds[0],
        ...fields
    }
}
it.each([Top, Shikoku])(
    'ends the final operating turn, records wealth, replays, reloads, and undoes: $info.id',
    (definition) => {
        const { game, engine, state } = example(definition, 'ending')
        expect(state.result).toBeUndefined()
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, 'FinishOperatingTurn', {
                companyId: state.trainPurchaseStep!.companyId
            })
        })
        expect(result.processedActions.map((a) => a.type)).toEqual([
            'FinishOperatingTurn',
            'EndGame'
        ])
        const after = result.updatedState
        expect(after.machineState).toBe('GameOver')
        expect(after.finalWealth).toHaveLength(3)
        expect(after.winningPlayerIds.length).toBeGreaterThan(0)
        expect(() => validateGameResult(after)).not.toThrow()
        const scoring = definition.runtime.scoring
        assertExists(scoring, '18xx titles declare final scores')
        const scores = scoring.finalScores(after)
        const highest = Math.max(...Object.values(scores))
        expect(Object.keys(scores).filter((id) => scores[id] === highest)).toEqual(
            after.winningPlayerIds
        )
        expect(after.activePlayerIds).toEqual([])
        for (const player of after.players)
            expect(engine.getValidActionTypesForPlayer(game, after, player.playerId)).toEqual([])
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state: after,
                action: action(after, 'Pass', { playerId: 'alex' })
            })
        ).toThrow()
        expect(definition.runtime.hydrator.hydrateState(after).dehydrate()).toEqual(after)
        let replay = state
        for (const processed of result.processedActions)
            replay = engine.applyProcessedAction({ game, state: replay, action: processed })
        expect(replay).toEqual(after)
        for (const processed of [...result.processedActions].reverse())
            replay = engine.undoProcessedAction({ state: replay, action: processed })
        expect(replay).toEqual(state)
    }
)
it('records the first TOP diesel once and preserves its final-set target through later actions', () => {
    const { game, engine, state } = example(Top, 'diesel')
    const train = TheOldPrinceTrainRules.depot.nextTrain(state.trainInventory, 'D')!
    const request = {
        companyId: state.trainPurchaseStep!.companyId,
        trainId: train.id,
        definitionId: 'D'
    }
    const purchase = new TrainPurchase(state, TheOldPrinceTrainRules).evaluate(request).details!
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'BuyTrain', { ...request, expectedPrice: purchase.price })
    })
    expect(result.processedActions.map((a) => a.type)).toContain('ScheduleGameEnd')
    expect(result.updatedState.gameEnding).toEqual({ reason: 'First diesel', finalOperatingSet: 2 })
    expect(result.updatedState.result).toBeUndefined()
    expect(result.updatedState.machineState).toBe('LayingTrack')
    const next = engine.executeCanonicalAction({
        game,
        state: result.updatedState,
        action: action(result.updatedState, 'FinishTrack', {
            companyId: result.updatedState.trackStep!.companyId
        })
    })
    expect(next.processedActions.map((a) => a.type)).not.toContain('ScheduleGameEnd')
    expect(next.updatedState.gameEnding).toEqual(result.updatedState.gameEnding)
})
it.each(['stock', 'operating'] as const)(
    '1889 bank break during %s schedules the correct set and pays in full',
    (during) => {
        const { game, engine, state } = example(Shikoku, during === 'stock' ? 'trading' : 'trains')
        const bank = state.cash.find((cash) => cash.owner.kind === 'bank')!
        bank.amount = 1
        const before = cashOwnedBy(state, { kind: 'player', playerId: 'alex' })
        settleCashPayments(state, [
            { from: { kind: 'bank' }, to: { kind: 'player', playerId: 'alex' }, amount: 50 }
        ])
        expect(cashOwnedBy(state, { kind: 'player', playerId: 'alex' })).toBe(Number(before) + 50)
        expect(bank.amount).toBe('unlimited')
        const scheduled = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, 'ScheduleGameEnd', {}, ActionSource.System)
        })
        expect(scheduled.updatedState.gameEnding).toEqual({
            reason: 'Bank broken',
            finalOperatingSet: 1
        })
        expect(scheduled.updatedState.result).toBeUndefined()
        expect(scheduled.updatedState.machineState).toBe(state.machineState)
    }
)
it('1889 retains a broken-bank trigger after later deposits and schedules the NEXT set from a later SR', () => {
    const { state } = example(Shikoku, 'trading')
    state.operatingSet = {
        number: 4,
        roundNumber: 2,
        roundCount: 2,
        companyOrder: [],
        completedCompanyIds: [],
        privateIncomePaid: true,
        completed: true
    }
    state.bank.broken = true
    state.cash.find((cash) => cash.owner.kind === 'bank')!.amount = 'unlimited'
    settleCashPayments(state, [
        { from: { kind: 'player', playerId: 'alex' }, to: { kind: 'bank' }, amount: 1 }
    ])
    expect(Shikoku1889EndingRules.trigger(state)).toEqual({
        reason: 'Bank broken',
        finalOperatingSet: 5
    })
})
it('finishes TOP’s current set, a final stock round, and exactly three final operating rounds', () => {
    const { game, engine, state } = example(Top, 'ending')
    state.operatingSet!.number = 1
    const completed = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'FinishOperatingTurn', {
            companyId: state.trainPurchaseStep!.companyId
        })
    })
    let current = completed.updatedState
    expect(current.machineState).toBe('StockRound')
    expect(current.operatingSet!.completed).toBe(true)
    expect(current.result).toBeUndefined()
    for (const company of current.companies)
        if (company.kind === 'major') {
            company.floated = false
            company.closed = true
        }
    const history: GameAction[] = []
    for (let count = 0; count < 3; count++) {
        const result = engine.executeCanonicalAction({
            game,
            state: current,
            action: action(current, 'FinishStockTurn')
        })
        current = result.updatedState
        history.push(...result.processedActions)
    }
    expect(history.filter((a) => a.type === 'StartOperatingRound')).toHaveLength(3)
    expect(history.filter((a) => a.type === 'StartStockRound')).toHaveLength(0)
    expect(current.operatingSet).toMatchObject({ number: 2, roundNumber: 3, roundCount: 3 })
    expect(current.machineState).toBe('GameOver')
})
it('values TOP’s PEIR and Union Bank assets once and ignores retired certificates and railway treasuries', () => {
    const { state } = example(Top)
    const wealth = finalWealth(state, TheOldPrinceEndingRules)
    const owner = state.certificates.find((c) => c.companyId === 'UB' && !c.retired)!
    if (owner.retired || owner.owner.kind !== 'player') throw Error('Expected Union Bank owner')
    const ownerId = owner.owner.playerId
    const player = wealth.find((p) => p.playerId === ownerId)!
    const unionItems = player.items.filter((item) => item.label.startsWith('Union Bank:'))
    expect(unionItems.length).toBeGreaterThan(1)
    expect(unionItems.find((item) => item.assetId === 'cash:company:UB')!.value).toBe(40)
    expect(player.items.some((item) => item.assetId === owner.id)).toBe(false)
    expect(player.items.some((item) => item.assetId === 'cash:company:ML')).toBe(false)
    for (const certificate of state.certificates.filter(
        (c) => c.kind === 'share' && c.companyId === 'PEIR' && !c.retired
    )) {
        const item = wealth.flatMap((p) => p.items).find((item) => item.assetId === certificate.id)
        if (item) expect(item.value).toBe(80)
    }
    const certificate = state.certificates.find(
        (c) => c.id === unionItems.find((item) => item.assetId !== 'cash:company:UB')!.assetId
    )!
    certificate.retired = true
    const revised = finalWealth(state, TheOldPrinceEndingRules)
    expect(revised.flatMap((p) => p.items).some((item) => item.assetId === certificate.id)).toBe(
        false
    )
})
it('scores private face values only for their actual owner and awards tied winners', () => {
    const { game, engine, state } = example(Shikoku, 'ending')
    const wealth = finalWealth(state, Shikoku1889EndingRules)
    expect(
        wealth.find((p) => p.playerId === 'casey')!.items.find((i) => i.assetId === 'MF:charter')!
            .value
    ).toBe(30)
    expect(wealth.flatMap((p) => p.items).some((i) => i.assetId === 'ER:charter')).toBe(false)
    const maximum = Math.max(...wealth.map((player) => player.total))
    for (const cash of state.cash)
        if (cash.owner.kind === 'player' && typeof cash.amount === 'number') {
            const playerId = cash.owner.playerId
            cash.amount += maximum - wealth.find((player) => player.playerId === playerId)!.total
        }
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'FinishOperatingTurn', {
            companyId: state.trainPurchaseStep!.companyId
        })
    })
    expect(result.updatedState.result).toBe(GameResult.Draw)
    expect(result.updatedState.winningPlayerIds).toEqual(state.players.map((p) => p.playerId))
})

it('bank break caused by flotation is recorded in the stock round and undone with the purchase', () => {
    const { game, engine, state } = example(Shikoku, 'flotation')
    state.cash.find((cash) => cash.owner.kind === 'bank')!.amount = 1
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: purchase('SR:share:3', 65)
    })
    expect(result.processedActions.map((action) => action.type)).toEqual([
        'BuyShares',
        'FloatCompany',
        'ScheduleGameEnd'
    ])
    expect(result.updatedState.bank.broken).toBe(true)
    expect(result.updatedState.gameEnding?.finalOperatingSet).toBe(1)
    expect(result.updatedState.machineState).toBe('StockRound')
    let undone = result.updatedState
    for (const processed of [...result.processedActions].reverse())
        undone = engine.undoProcessedAction({ state: undone, action: processed })
    expect(undone).toEqual(state)
})
it('bankruptcy overrides a deferred ending and the bankrupt player can win', () => {
    const { game, engine, state } = example(Shikoku, 'ending')
    state.machineState = 'Bankrupt'
    state.bankruptcy = {
        playerId: 'casey',
        companyId: state.trainPurchaseStep!.companyId,
        shortfall: 100
    }
    state.cash.find(
        (cash) => cash.owner.kind === 'player' && cash.owner.playerId === 'casey'
    )!.amount = 10000
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'ScheduleGameEnd', {}, ActionSource.System)
    })
    expect(result.processedActions.map((action) => action.type)).toEqual([
        'ScheduleGameEnd',
        'EndGame'
    ])
    expect(result.updatedState.gameEnding).toEqual({ reason: 'Bankruptcy' })
    expect(result.updatedState.winningPlayerIds).toEqual(['casey'])
})
