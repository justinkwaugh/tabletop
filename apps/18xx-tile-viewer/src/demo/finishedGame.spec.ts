import { historyCash } from '../../../../libs/18xx-ui/src/lib/table/historyCash.js'
import { expect, it } from 'vitest'
import { historyOperatingOrder } from '../../../../libs/18xx-ui/src/lib/table/historyOperatingOrder.js'
import { historyGroups } from '../../../../libs/18xx-ui/src/lib/table/historyGroups.js'
import { historyDescription } from '../../../../libs/18xx-ui/src/lib/table/historyDescription.js'
import { historyRounds } from '../../../../libs/18xx-ui/src/lib/table/historyRounds.js'
import { finishedGame } from './finishedGame.js'
import { reorderPendingOperatingCompanies } from '@tabletop/18xx'

it('replays the finished game and restores every history step in both directions', async () => {
    const { game, state, initialState, actions, engine } = await finishedGame(
        'local-user',
        'Finished game'
    )
    expect(state.finalWealth?.map(({ total }) => total)).toEqual([6764, 7328, 7126])
    expect(actions).toHaveLength(1071)
    const contribution = actions.find((action) => action.id === 'recorded:727')
    expect(contribution).toMatchObject({ type: 'ContributeTrainFunds', amount: 400 })
    expect(actions.some((action) => action.id === 'recorded:725')).toBe(false)
    const cashHistory = historyCash(actions, state)
    const orders = historyOperatingOrder(actions, state)
    expect(orders.size).toBeGreaterThan(0)
    const fundingSale = actions.find((action) => action.type === 'SellFundingShares')!
    expect(historyDescription(fundingSale, state).beforeText).toBe('President owes $400 and is short $135')
    expect(orders.get(fundingSale.id)?.after).toEqual(['MS', 'S', 'A', 'So', 'C', 'branch:BB', 'MR', 'Gt'])
    expect(historyDescription(fundingSale, state).detail).toContain('Market')
    const rounds = historyRounds(actions, state)
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
            if (entry.owner.kind === 'company') expect(cash.before.get(entry.owner.companyId)).toBe(entry.amount)
        restored = engine.applyProcessedAction({ game, state: restored, action })
        for (const entry of restored.cash)
            if (entry.owner.kind === 'company') expect(cash.after.get(entry.owner.companyId)).toBe(entry.amount)
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
