import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import type { CorporateFinance } from '@tabletop/18xx'
import {
    constructionOperatingSteps,
    historicalOperatingStepIndex,
    operatingStepIndex
} from './operatingStep.js'
import { historyStateFixture } from './history.fixture.js'
import { operatingStepStatuses } from './operatingStepStatuses.js'
import { moneyFormat } from '../presentation/money.js'

it('labels the recorded operation rather than the next decision', () => {
    const action = (type: string): GameAction => ({
        id: type,
        gameId: 'game',
        type,
        source: ActionSource.User
    })
    expect(historicalOperatingStepIndex(action('RunTrains'), 'DistributingEarnings')).toBe(2)
    expect(historicalOperatingStepIndex(action('DistributeEarnings'), 'BuyingTrains')).toBe(3)
    expect(historicalOperatingStepIndex(action('BuyTrain'), 'BuyingTrains')).toBe(4)
    expect(operatingStepIndex('DistributingEarnings')).toBe(3)
    expect(operatingStepIndex('BuyingTrains')).toBe(4)
})

it('builds track, stations and share issues in one step when stations come with track', () => {
    const steps = constructionOperatingSteps(
        { additionalConstructionActions: ['BuildPrivateTrack'] },
        { payout: ['SettleIndependent'] }
    )
    expect(steps.map((step) => step.label)).toEqual(['Build', 'Run', 'Payout', 'Trains'])
    expect(steps[0].actions).toEqual(
        expect.arrayContaining(['LayTile', 'PlaceStation', 'CorporateFinance', 'BuildPrivateTrack'])
    )
    expect(steps[2].actions).toEqual(['DistributeEarnings', 'SettleIndependent'])
    const state = historyStateFixture()
    const issue = (shares: number): CorporateFinance => ({
        id: `issue-${shares}`,
        gameId: 'game',
        type: 'CorporateFinance',
        source: ActionSource.User,
        playerId: 'alex',
        companyId: 'A',
        operation: 'issue',
        shares,
        amount: shares * 10
    })
    const actions = [issue(1), issue(2)]
    const summaries = operatingStepStatuses(state, actions, moneyFormat('$'))
    expect(steps[0].status?.(state, actions, summaries)).toBe('Issued 3')
})
