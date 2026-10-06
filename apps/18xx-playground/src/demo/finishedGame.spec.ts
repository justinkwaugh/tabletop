import { CanonicalValidator as Validator1846, HydratedEighteenFortySixState } from '@tabletop/1846'
import { HistoricalMaps } from '../../../../libs/18xx-ui/src/lib/maps/historicalMap.js'
import { mapState1846 } from '../../../../games/1846-ui/src/lib/mapState.js'
import { MapView1846 } from '../../../../games/1846-ui/src/lib/mapView.js'
import { historyStates } from '../../../../libs/18xx-ui/src/lib/table/historyStates.js'
import { historyCash } from '../../../../libs/18xx-ui/src/lib/table/historyCash.js'
import { expect, it } from 'vitest'
import { isStartOperatingRound } from '@tabletop/18xx'
import { historyOperatingOrder } from '../../../../libs/18xx-ui/src/lib/table/historyOperatingOrder.js'
import { historyGroups } from '../../../../libs/18xx-ui/src/lib/table/historyGroups.js'
import { historyDescription } from '../../../../libs/18xx-ui/src/lib/table/historyDescription.js'
import { historyCompanyChanges } from '../../../../libs/18xx-ui/src/lib/table/historyCompanyChanges.js'
import { shouldContinueHistoryStep } from '../../../../libs/18xx-ui/src/lib/table/historyNavigation.js'
import { historyRounds } from '../../../../libs/18xx-ui/src/lib/table/historyRounds.js'
import { EighteenSeventeenPresentation } from '../../../../games/1817-ui/src/lib/presentation.js'
import { finishedGame, replayFinishedGame, replayRecordedGame } from './finishedGame.js'
import { playgroundTitle } from '../titles.js'
import {
    finalWealth,
    reorderPendingOperatingCompanies,
    isRunTrains,
    isDistributeEarnings
} from '@tabletop/18xx'
import { ActionSource, assertExists } from '@tabletop/common'

function wealthByPlayer(wealth: readonly { playerId: string; total: number }[] | undefined) {
    assertExists(wealth, 'The game has its final wealth')
    return Object.fromEntries(wealth.map(({ playerId, total }) => [playerId, total]))
}

it('replays the finished 1846 game and restores its opening and final state', async () => {
    const { game, state, initialState, actions, engine } = await finishedGame(
        'local-user',
        'Finished game',
        '1846'
    )
    const maps = new HistoricalMaps(
        () => MapView1846,
        (snapshot: typeof state) => {
            if (!Validator1846.Check(snapshot)) throw Error('Expected canonical 1846 state')
            return mapState1846(new HydratedEighteenFortySixState(snapshot))
        }
    )
    const markerRun = actions.find((action) => action.id === 'recorded:80')
    assertExists(markerRun)
    const preview = maps.preview(state, actions, markerRun)
    expect(
        preview.scene.locations.find((location) => location.location.id === 'I1')?.location.markers
    ).toContainEqual(expect.objectContaining({ id: 'IC:MPC' }))
    expect(state.machineState).toBe('GameOver')
    expect(state.gameEnding?.reason).toBe('Bank broken')
    expect(state.activePlayerIds).toEqual([])
    expect(wealthByPlayer(state.finalWealth)).toEqual({
        gragatrim: 6180,
        the_seaward: 4950,
        hoolaking: 1803
    })
    expect(actions.length).toBeGreaterThan(479)
    expect(state.phaseId).toBe('IV')
    expect(Object.keys(state.tileInventory.placements).length).toBeGreaterThan(35)
    let restored = state
    for (const action of [...actions].reverse())
        restored = engine.undoProcessedAction({ state: restored, action })
    expect(restored).toEqual(initialState)
    for (const action of actions)
        restored = engine.applyProcessedAction({ game, state: restored, action })
    expect(restored).toEqual(state)
}, 120000)

it('replays the finished game and restores every history step in both directions', async () => {
    const { game, state, initialState, actions, engine } = await finishedGame(
        'local-user',
        'Finished game',
        'the-old-prince'
    )
    expect(state.finalWealth?.map(({ total }) => total)).toEqual([6764, 7328, 7126])
    expect(actions).toHaveLength(1071)
    const contribution = actions.find((action) => action.id === 'recorded:727')
    expect(contribution).toMatchObject({ type: 'ContributeTrainFunds', amount: 400 })
    expect(actions.some((action) => action.id === 'recorded:725')).toBe(false)
    const snapshots = historyStates(actions, state)
    const cashHistory = historyCash(snapshots)
    const orders = historyOperatingOrder(actions, snapshots)
    expect(orders.size).toBeGreaterThan(0)
    const fundingSale = actions.find((action) => action.type === 'SellFundingShares')!
    expect(historyDescription(fundingSale, state).beforeText).toBe(
        'President owes $400 and is short $135'
    )
    expect(orders.get(fundingSale.id)?.after).toEqual([
        'MS',
        'S',
        'A',
        'So',
        'C',
        'branch:BB',
        'MR',
        'Gt'
    ])
    expect(historyDescription(fundingSale, state).detail).toContain('Market')
    const rounds = historyRounds(actions, state)
    const operatingRounds = rounds.filter((round) => round.label.startsWith('OR '))
    expect(operatingRounds.every((round) => round.operatingOrder?.after.length)).toBe(true)
    // A round's start is listed only for private income paid to companies.
    expect(
        operatingRounds
            .flatMap((round) => round.entries)
            .every(
                (entry) =>
                    entry.kind !== 'action' ||
                    !isStartOperatingRound(entry.action) ||
                    entry.action.metadata?.payments.some((payment) => payment.to.kind === 'company')
            )
    ).toBe(true)
    const thirdStockRound = new Set(
        rounds.find((round) => round.label === 'SR 3')?.entries.map((entry) => entry.id)
    )
    const firstPurchaseIndex = actions.findIndex(
        (action) => thirdStockRound.has(action.id) && action.type === 'BuyShares'
    )
    const firstPurchase = actions[firstPurchaseIndex]
    const automaticFinish = actions[firstPurchaseIndex + 1]
    const followingPass = actions[firstPurchaseIndex + 2]
    assertExists(firstPurchase, 'SR 3 requires its first share purchase')
    assertExists(automaticFinish, 'SR 3 requires automatic turn completion')
    assertExists(followingPass, 'SR 3 requires the following pass')
    expect(automaticFinish).toMatchObject({
        type: 'FinishStockTurn',
        source: ActionSource.System,
        metadata: { passed: false }
    })
    expect(followingPass).toMatchObject({
        type: 'FinishStockTurn',
        source: ActionSource.User,
        metadata: { passed: true }
    })
    expect(shouldContinueHistoryStep(firstPurchase, automaticFinish)).toBe(false)
    expect(shouldContinueHistoryStep(automaticFinish, followingPass)).toBe(true)
    const trainlessActions = actions.filter(
        (action) =>
            (isRunTrains(action) && action.metadata?.revenue === 0) ||
            (isDistributeEarnings(action) && action.metadata?.revenue === 0)
    )
    expect(trainlessActions.length).toBeGreaterThan(0)
    const visibleIds = new Set(rounds.flatMap((round) => round.entries.map((entry) => entry.id)))
    for (const action of trainlessActions) {
        expect(visibleIds.has(action.id)).toBe(true)
        const description = historyDescription(action, state)
        expect(description.text).toBe(
            action.type === 'RunTrains' ? 'Did not run trains' : 'Did not pay out'
        )
        if (
            isDistributeEarnings(action) &&
            action.metadata?.marketMove &&
            action.metadata.marketMove.fromMarketSpaceId !==
                action.metadata.marketMove.toMarketSpaceId
        )
            expect(description.detail).toContain('Market')
    }
    expect(rounds.map((round) => round.label)).toEqual([
        'OR 8.3',
        'OR 8.2',
        'OR 8.1',
        'SR 8',
        'OR 7.3',
        'OR 7.2',
        'OR 7.1',
        'SR 7',
        'OR 6.2',
        'OR 6.1',
        'SR 6',
        'OR 5.2',
        'OR 5.1',
        'SR 5',
        'OR 4.2',
        'OR 4.1',
        'SR 4',
        'OR 3.1',
        'SR 3',
        'OR 2.1',
        'SR 2',
        'OR 1.1',
        'SR 1',
        'Auction'
    ])
    expect(rounds.find((round) => round.id === 'OR 7.1')?.phases).toEqual(['7', 'D'])
    expect(rounds.find((round) => round.id === 'OR 6.1')?.phases).toEqual(['3+', '4+', '7'])
    expect(rounds.find((round) => round.id === 'OR 3.1')?.phases).toEqual(['2H', '3H', '4H'])
    expect(rounds.at(-1)?.phases).toEqual(['2H'])
    expect(rounds.at(-1)?.entries.every((entry) => entry.kind === 'auction')).toBe(true)
    const groups = rounds.flatMap((round) =>
        historyGroups(round.entries, round.label.startsWith('OR '))
    )
    const groupedActions = groups.flatMap((group) =>
        group.kind === 'auction' ? [] : group.actions
    )
    expect(new Set(groupedActions.map((action) => action.id)).size).toBe(groupedActions.length)
    expect(groupedActions.length).toBe(
        rounds.flatMap((round) => round.entries.filter((entry) => entry.kind === 'action')).length
    )
    expect(groups.filter((group) => group.kind === 'operation')).toHaveLength(91)
    for (const action of groupedActions) expect(historyDescription(action, state).text).toBeTruthy()
    let restored = state
    for (const action of [...actions].reverse())
        restored = engine.undoProcessedAction({ state: restored, action })
    expect(restored).toEqual(initialState)
    for (const action of actions) {
        const cash = cashHistory.get(action.id)!
        for (const entry of restored.cash)
            if (entry.owner.kind === 'company')
                expect(cash.before.get(entry.owner.companyId)).toBe(entry.amount)
        restored = engine.applyProcessedAction({ game, state: restored, action })
        for (const entry of restored.cash)
            if (entry.owner.kind === 'company')
                expect(cash.after.get(entry.owner.companyId)).toBe(entry.amount)
    }
    expect(restored).toEqual(state)
    const pending = structuredClone(initialState)
    pending.operatingSet = {
        number: 1,
        roundNumber: 1,
        roundCount: 1,
        companyOrder: ['MS', 'A', 'MR', 'S'],
        completedCompanyIds: ['MS'],
        privateIncomePaid: true,
        completed: false
    }
    reorderPendingOperatingCompanies(pending, ['S', 'A', 'MR', 'MS'])
    expect(pending.operatingSet.companyOrder).toEqual(['MS', 'A', 'S', 'MR'])
}, 60000)

it('replays the finished 1889 game to its bank-break ending and back', async () => {
    const { game, state, initialState, actions, engine } = await finishedGame(
        'local-user',
        'Finished game',
        'shikoku-1889'
    )
    expect(state.machineState).toBe('GameOver')
    expect(state.finalWealth?.map(({ playerId, total }) => [playerId, total])).toEqual([
        ['1230', 3880],
        ['545', 4444],
        ['253', 4317],
        ['147', 3091]
    ])
    expect(state.winningPlayerIds).toEqual(['545'])
    const rounds = historyRounds(actions, state)
    expect(rounds.at(-1)?.label).toBe('Auction')
    expect(rounds.some((round) => round.label.startsWith('OR '))).toBe(true)
    for (const action of actions) expect(historyDescription(action, state).text).toBeTruthy()
    let restored = state
    for (const action of [...actions].reverse())
        restored = engine.undoProcessedAction({ state: restored, action })
    expect(restored).toEqual(initialState)
    for (const action of actions)
        restored = engine.applyProcessedAction({ game, state: restored, action })
    expect(restored).toEqual(state)
}, 60000)

it('describes 1830’s awards and the B&O closure in the finished game’s history', async () => {
    const { state, actions } = await finishedGame('local-user', 'Finished game', '1830')
    const changes = historyCompanyChanges(actions)
    const describe = (action: (typeof actions)[number]) => {
        const description = historyDescription(
            action,
            state,
            undefined,
            undefined,
            changes.get(action.id)
        )
        return [description.text, description.detail].join(' | ')
    }
    const lines = actions.map(describe)
    expect(lines.some((line) => /CA.*with 1 PRR/.test(line))).toBe(true)
    expect(lines.some((line) => /BOP.*with the BO president’s certificate/.test(line))).toBe(true)
    const firstBaltimoreTrain = actions.find(
        (action) => action.type === 'BuyTrain' && Reflect.get(action, 'companyId') === 'BO'
    )
    assertExists(firstBaltimoreTrain, 'B&O buys a train')
    expect(describe(firstBaltimoreTrain)).toContain('BOP closed')
    const homeChoice = {
        id: 'home',
        gameId: 'game',
        source: ActionSource.User,
        playerId: state.players[0].playerId,
        type: 'ChooseHomeStation',
        companyId: 'ERIE',
        locationId: 'E11',
        nodeId: 'city-1'
    }
    expect(historyDescription(homeChoice, state).text).toBe('Home station at E11')
}, 120000)

it('replays the finished 1830 game to its bank-break ending and back', async () => {
    const { game, state, initialState, actions, engine } = await finishedGame(
        'local-user',
        'Finished game',
        '1830'
    )
    expect(state.machineState).toBe('GameOver')
    expect(wealthByPlayer(state.finalWealth)).toEqual({
        '15698': 12025,
        '13430': 13048,
        '15688': 12109
    })
    expect(state.winningPlayerIds).toEqual(['13430'])
    for (const action of actions) expect(historyDescription(action, state).text).toBeTruthy()
    let restored = state
    for (const action of [...actions].reverse())
        restored = engine.undoProcessedAction({ state: restored, action })
    expect(restored).toEqual(initialState)
    for (const action of actions)
        restored = engine.applyProcessedAction({ game, state: restored, action })
    expect(restored).toEqual(state)
}, 120000)

it.each([
    ['26855', { '82': 2127, '117': 310, '330': 2212, '1627': 1831 }],
    ['29133', { '1668': 416, '4631': 1477, '4639': 951, '4836': 887 }]
] as const)(
    'replays recorded 1830 game %s to its bankruptcy',
    async (id, wealth) => {
        const fixture = (await import(`./fixtures/1830-bankruptcy-${id}.json`)).default
        const { state } = await replayFinishedGame(
            playgroundTitle('1830'),
            fixture,
            'local-user',
            'Recorded game'
        )
        expect(state.machineState).toBe('GameOver')
        expect(state.gameEnding?.reason).toBe('Bankruptcy')
        expect(wealthByPlayer(state.finalWealth)).toEqual(wealth)
    },
    120000
)

it('replays the finished 1817 game to its ending and back', async () => {
    const { game, state, initialState, actions, engine } = await finishedGame(
        'local-user',
        'Finished game',
        '1817'
    )
    expect(state.machineState).toBe('GameOver')
    expect(wealthByPlayer(state.finalWealth)).toEqual({
        '655': 10127,
        '1594': 11490,
        '3370': 6257,
        '5159': 7066
    })
    const snapshots = historyStates(actions, state)
    const rounds = historyRounds(
        actions,
        state,
        snapshots,
        historyOperatingOrder(actions, snapshots),
        historyCash(snapshots),
        { rounds: EighteenSeventeenPresentation.titleRounds }
    )
    expect(rounds.map((round) => round.label).slice(0, 4)).toEqual([
        'AR 7.2',
        'MR 7.2',
        'OR 7.2',
        'AR 7.1'
    ])
    expect(new Set(rounds.map((round) => round.id)).size).toBe(rounds.length)
    for (const action of actions) expect(historyDescription(action, state).text).toBeTruthy()
    let restored = state
    for (const action of [...actions].reverse())
        restored = engine.undoProcessedAction({ state: restored, action })
    expect(restored).toEqual(initialState)
    for (const action of actions)
        restored = engine.applyProcessedAction({ game, state: restored, action })
    expect(restored).toEqual(state)
}, 240000)

// These games were ended by hand, one in a player's cash crisis; what that player still owes
// counts against them.
it.each(['16281', '16852', '20758'])(
    'replays recorded 1817 game %s to its last action and its players’ values',
    async (id) => {
        const title = playgroundTitle('1817')
        const fixture = (await import(`./fixtures/1817-recorded-${id}.json`)).default
        const { state } = await replayRecordedGame(title, fixture, 'local-user', 'Recorded game')
        const owed = (playerId: string) =>
            (state.cashCrisis?.debts ?? [])
                .filter((debt) => debt.playerId === playerId)
                .reduce((sum, debt) => sum + debt.amount, 0)
        expect(
            wealthByPlayer(
                finalWealth(state, title.rules.endingRules).map((wealth) => ({
                    ...wealth,
                    total: wealth.total - owed(wealth.playerId)
                }))
            )
        ).toEqual(fixture.finalWealth)
    },
    120000
)

it('replays the recorded 1817 Volatility game to its bankruptcy ending', async () => {
    const fixture = (await import('./fixtures/1817-bankruptcy.json')).default
    const { state } = await replayFinishedGame(
        playgroundTitle('1817'),
        fixture,
        'local-user',
        'Recorded game'
    )
    expect(state.machineState).toBe('GameOver')
    expect(state.gameEnding?.reason).toBe('Bankruptcy')
    expect(wealthByPlayer(state.finalWealth)).toEqual({
        '4738': 1646,
        '7791': 0,
        '10573': 0,
        '12235': 0,
        '18003': 0
    })
}, 120000)
