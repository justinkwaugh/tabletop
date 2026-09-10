import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    Definition as Top,
    TheOldPrinceEarningsRules,
    TheOldPrinceTrainRules,
    peirShares
} from '@tabletop/the-old-prince'
import {
    Definition as Shikoku,
    Shikoku1889EarningsRules,
    Shikoku1889TrainRules
} from '@tabletop/shikoku-1889'
import {
    EarningsDistribution,
    cashOwnedBy,
    getCompany,
    placeStockMarker,
    finishOperatingTurnReason,
    type FinanceExampleState,
    type EarningsChoice
} from '@tabletop/18xx'
import { example } from './stockTestUtils.js'
const Titles = [
    {
        definition: Top,
        rules: TheOldPrinceEarningsRules,
        trainRules: TheOldPrinceTrainRules,
        companyId: 'ML'
    },
    {
        definition: Shikoku,
        rules: Shikoku1889EarningsRules,
        trainRules: Shikoku1889TrainRules,
        companyId: 'IR'
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
function earnings(state: FinanceExampleState, companyId: string, revenue: number) {
    state.machineState = 'DistributingEarnings'
    state.routeStep = { companyId, result: { companyId, routes: [], revenue } }
}
it('pays TOP bank and treasury shares to the company, and Union Bank shares to Union Bank', () => {
    const { state } = example(Top, 'routes')
    earnings(state, 'ML', 100)
    const details = new EarningsDistribution(state, TheOldPrinceEarningsRules).evaluate(
        'ML',
        'pay'
    ).details!
    expect(details.payments.map((p) => [p.to, p.amount])).toEqual([
        [{ kind: 'player', playerId: 'alex' }, 30],
        [{ kind: 'company', companyId: 'UB' }, 10],
        [{ kind: 'player', playerId: 'blair' }, 20],
        [{ kind: 'company', companyId: 'ML' }, 40]
    ])
    expect(details.bankAdjustment).toBe(0)
})
it('1889 leaves IPO dividends in the bank and pays Market shares to the treasury', () => {
    const { state } = example(Shikoku, 'routes')
    earnings(state, 'AR', 100)
    const details = new EarningsDistribution(state, Shikoku1889EarningsRules).evaluate(
        'AR',
        'pay'
    ).details!
    expect(details.payments.map((p) => [p.to, p.amount])).toEqual([
        [{ kind: 'player', playerId: 'alex' }, 30],
        [{ kind: 'player', playerId: 'blair' }, 10],
        [{ kind: 'player', playerId: 'casey' }, 10],
        [{ kind: 'company', companyId: 'AR' }, 10]
    ])
    expect(details.bankAdjustment).toBe(-40)
    expect(
        new EarningsDistribution(state, Shikoku1889EarningsRules).evaluate('AR', 'half-pay').reason
    ).toBeTruthy()
})
it('PEIR uses surviving shares, rounds each dividend up and retains the rounded-up half', () => {
    const { state } = example(Top, 'routes')
    const removed = new Set(
        peirShares(state)
            .slice(0, 2)
            .map((c) => c.id)
    )
    state.certificates = state.certificates.map((c) =>
        removed.has(c.id)
            ? {
                  id: c.id,
                  companyId: c.companyId,
                  kind: 'share',
                  shares: 1,
                  president: false,
                  certificateLimitCount: 0,
                  retired: true
              }
            : c
    )
    earnings(state, 'PEIR', 101)
    const distribution = new EarningsDistribution(state, TheOldPrinceEarningsRules)
    const full = distribution.evaluate('PEIR', 'pay').details!
    expect(full.dividendPerShare).toBe(34)
    expect(full.bankAdjustment).toBe(1)
    expect(full.marketMove).toBeUndefined()
    const half = distribution.evaluate('PEIR', 'half-pay').details!
    expect(half.retained).toBe(51)
    expect(half.dividendPerShare).toBe(17)
    expect(half.bankAdjustment).toBe(1)
})
it('TOP adds forty per share only when paying from the market ceiling', () => {
    const { state } = example(Top, 'routes')
    earnings(state, 'ML', 100)
    const ceiling = state.stockMarket.spaces.find((s) => s.price === 400)!
    placeStockMarker(state.stockMarket, 'ML', ceiling.id)
    const distribution = new EarningsDistribution(state, TheOldPrinceEarningsRules)
    expect(distribution.evaluate('ML', 'pay').details).toMatchObject({
        bonusPerShare: 40,
        dividendPerShare: 50,
        bankAdjustment: 400
    })
    expect(distribution.evaluate('ML', 'withhold').details).toMatchObject({
        bonusPerShare: 0,
        retained: 100,
        dividendPerShare: 0
    })
    const before = state.stockMarket.spaces.find((s) => s.moves.right === ceiling.id)!
    placeStockMarker(state.stockMarket, 'ML', before.id)
    expect(distribution.evaluate('ML', 'pay').details).toMatchObject({
        bonusPerShare: 0,
        marketMove: { toMarketSpaceId: ceiling.id }
    })
})
it.each(Titles)(
    'settles $companyId earnings once, validates actors, and restores cash/market through replay and undo',
    ({ definition, rules, companyId }) => {
        const { game, engine, state } = example(definition, 'routes')
        const run = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, 'RunTrains', { companyId, routes: [] })
        })
        const before = run.updatedState
        const choice: EarningsChoice = 'withhold'
        const distribute = action(before, 'DistributeEarnings', { companyId, choice })
        for (const invalid of [
            { ...distribute, playerId: 'casey' },
            { ...distribute, source: ActionSource.System }
        ])
            expect(() =>
                engine.executeCanonicalAction({ game, state: before, action: invalid })
            ).toThrow()
        const result = engine.executeCanonicalAction({ game, state: before, action: distribute })
        expect(result.updatedState.machineState).toBe('BuyingTrains')
        expect(result.updatedState.earningsDistribution).toEqual(
            new EarningsDistribution(before, rules).evaluate(companyId, choice).details
        )
        expect(getCompany(result.updatedState, companyId).operated).toBe(true)
        expect(() =>
            engine.executeCanonicalAction({ game, state: result.updatedState, action: distribute })
        ).toThrow()
        expect(
            engine.applyProcessedAction({ game, state: before, action: result.processedActions[0] })
        ).toEqual(result.updatedState)
        expect(
            engine.undoProcessedAction({
                state: result.updatedState,
                action: result.processedActions[0]
            })
        ).toEqual(before)
        expect(JSON.stringify(definition.runtime.hydrator.hydrateAction(distribute))).not.toContain(
            'rules'
        )
    }
)
it.each(Titles)(
    'completes every ordinary operating round for $companyId and resumes the preserved stock order',
    ({ definition, companyId }) => {
        const { game, engine, state } = example(definition, 'operations')
        let current = state
        expect(current.machineState).toBe('LayingTrack')
        const order = [...state.turnManager.turnOrder],
            rounds = state.operatingSet!.roundCount
        const expectedTurns = state.operatingSet!.companyOrder.length * rounds
        const privateId = definition === Top ? 'KM' : 'ER',
            recipient = definition === Top ? 'PEIR' : 'IR',
            privateRevenue = getCompany(state, privateId).privateRevenue!
        const initialCash = cashOwnedBy(state, { kind: 'company', companyId: recipient })
        const seen: string[] = []
        for (
            let count = 0;
            count < expectedTurns * 7 && current.machineState !== 'StockRound';
            count++
        ) {
            const id =
                current.privatePowerWindow?.companyId ??
                current.trackStep?.companyId ??
                current.routeStep?.companyId ??
                current.trainPurchaseStep!.companyId
            const type = current.privatePowerWindow
                ? 'ContinueOperatingRound'
                : current.machineState === 'LayingTrack'
                  ? 'FinishTrack'
                  : current.machineState === 'PlacingStation'
                    ? 'FinishStations'
                    : current.machineState === 'RunningTrains'
                      ? 'RunTrains'
                      : current.machineState === 'DistributingEarnings'
                        ? 'DistributeEarnings'
                        : 'FinishOperatingTurn'
            const fields =
                type === 'RunTrains'
                    ? { companyId: id, routes: [] }
                    : type === 'DistributeEarnings'
                      ? { companyId: id, choice: 'withhold' }
                      : { companyId: id }
            const result = engine.executeCanonicalAction({
                game,
                state: current,
                action: action(current, type, fields)
            })
            if (type === 'FinishOperatingTurn') seen.push(id)
            let replay = current
            for (const processed of result.processedActions)
                replay = engine.applyProcessedAction({ game, state: replay, action: processed })
            expect(replay).toEqual(result.updatedState)
            let undone = result.updatedState
            for (const processed of [...result.processedActions].reverse())
                undone = engine.undoProcessedAction({ state: undone, action: processed })
            expect(undone).toEqual(current)
            current = result.updatedState
        }
        expect(seen).toHaveLength(expectedTurns)
        expect(seen[0]).toBe(companyId)
        expect(current.machineState).toBe('StockRound')
        expect(current.stockRound).toMatchObject({
            number: 3,
            completed: false,
            passedPlayerIds: [],
            sales: []
        })
        expect(current.operatingSet?.completed).toBe(true)
        expect(current.turnManager.turnOrder).toEqual(order)
        expect(current.activePlayerIds[0]).toBe(order[0])
        expect(cashOwnedBy(current, { kind: 'company', companyId: recipient })).toBe(
            Number(initialCash) + (rounds - 1) * privateRevenue
        )
        expect(current.trackStep).toBeUndefined()
        expect(current.earningsDistribution).toBeUndefined()
    }
)
it.each(Titles)(
    'requires a train when $companyId has connected revenue centers',
    ({ definition, companyId, trainRules }) => {
        const { state } = example(definition, 'routes')
        state.trainPurchaseStep = { companyId, purchasedTrainIds: [] }
        state.trainInventory.trains = state.trainInventory.trains.map((t) =>
            t.status === 'owned' ? { id: t.id, definitionId: t.definitionId, status: 'removed' } : t
        )
        expect(finishOperatingTurnReason(state, trainRules, companyId)).toContain(
            'must buy a train'
        )
        state.stations = []
        expect(finishOperatingTurnReason(state, trainRules, companyId)).toBeUndefined()
    }
)
it('exempts PEIR from compulsory train ownership', () => {
    const { state } = example(Top, 'routes')
    expect(TheOldPrinceTrainRules.requiresTrain(state, 'PEIR')).toBe(false)
})

it.each(Titles)(
    'moves a floated trainless company left but leaves un-floated companies alone for $companyId',
    ({ definition, rules, companyId }) => {
        const { state } = example(definition, 'routes')
        earnings(state, companyId, 0)
        const distribution = new EarningsDistribution(state, rules)
        const move = distribution.evaluate(companyId, 'pay').details!.marketMove!
        const from = state.stockMarket.spaces.find((space) => space.id === move.fromMarketSpaceId)!
        expect(move.toMarketSpaceId).toBe(from.moves.left ?? from.moves.down ?? from.id)
        getCompany(state, companyId).floated = false
        expect(distribution.evaluate(companyId, 'withhold').details!.marketMove).toBeUndefined()
    }
)
it.each(Titles)('uses dividend edge arrows for $companyId', ({ definition, rules, companyId }) => {
    const { state } = example(definition, 'routes')
    earnings(state, companyId, 100)
    const distribution = new EarningsDistribution(state, rules)
    for (const [choice, direction, edge] of [
        ['pay', 'right', 'up'],
        ['withhold', 'left', 'down']
    ] as const) {
        const from = state.stockMarket.spaces.find(
            (space) => !space.moves[direction] && space.moves[edge]
        )!
        placeStockMarker(state.stockMarket, companyId, from.id)
        expect(distribution.evaluate(companyId, choice).details!.marketMove!.toMarketSpaceId).toBe(
            from.moves[edge]
        )
    }
})
it.each(Titles)(
    'pays private income once and refreshes company order while retaining set length for $companyId',
    ({ definition, companyId }) => {
        const { game, engine, state } = example(definition, 'operations')
        state.machineState = 'OperatingSet'
        state.operatingSet!.completedCompanyIds = [...state.operatingSet!.companyOrder]
        const last = state.operatingSet!.companyOrder.find(
            (id) => id !== companyId && id !== 'PEIR'
        )!
        placeStockMarker(
            state.stockMarket,
            last,
            state.stockMarket.spaces.find((space) => space.price === 200)!.id
        )
        state.phaseId = definition === Top ? '7' : '5'
        const count = state.operatingSet!.roundCount
        const start = { ...action(state, 'StartOperatingRound'), source: ActionSource.System }
        const result = engine.executeCanonicalAction({ game, state, action: start })
        expect(result.updatedState.operatingSet).toMatchObject({
            roundNumber: 2,
            roundCount: count,
            completedCompanyIds: [],
            privateIncomePaid: true
        })
        expect(result.updatedState.operatingSet!.companyOrder[0]).toBe(last)
        expect(() =>
            engine.executeCanonicalAction({ game, state: result.updatedState, action: start })
        ).toThrow()
        expect(() =>
            definition.runtime.hydrator
                .hydrateAction(start)
                .apply(definition.runtime.hydrator.hydrateState(result.updatedState))
        ).toThrow()
    }
)
it('previews a bank-breaking payment without mutation, then pays in full and schedules the ending', () => {
    const { game, engine, state } = example(Shikoku, 'routes')
    earnings(state, 'IR', 100)
    state.cash.find((cash) => cash.owner.kind === 'bank')!.amount = 0
    const before = structuredClone(state)
    expect(
        new EarningsDistribution(state, Shikoku1889EarningsRules).evaluate('IR', 'withhold').details
    ).toBeDefined()
    expect(state).toEqual(before)
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'DistributeEarnings', { companyId: 'IR', choice: 'withhold' })
    })
    expect(result.processedActions.map((action) => action.type)).toEqual([
        'DistributeEarnings',
        'ScheduleGameEnd'
    ])
    expect(result.updatedState.bank.broken).toBe(true)
    expect(result.updatedState.gameEnding?.finalOperatingSet).toBe(1)
    expect(result.updatedState.machineState).toBe('BuyingTrains')
    expect(cashOwnedBy(result.updatedState, { kind: 'company', companyId: 'IR' })).toBe(
        Number(cashOwnedBy(state, { kind: 'company', companyId: 'IR' })) + 100
    )
})
