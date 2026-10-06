import { expect, it } from 'vitest'
import { TestCompanyId } from '@tabletop/18xx/testing'
import { historyStateFixture } from './history.fixture.js'
import { operatingStepStatuses } from './operatingStepStatuses.js'
import { moneyFormat } from '../presentation/money.js'

it('exposes independent construction and train summaries for combined title steps', () => {
    const state = historyStateFixture()
    state.stationStep = { companyId: TestCompanyId, placedStationIds: ['station'], completed: true }
    state.trainPurchaseStep = {
        companyId: TestCompanyId,
        purchasedTrainIds: ['train-a', 'train-b']
    }
    const summaries = operatingStepStatuses(state, [], moneyFormat('$'))
    expect(summaries.station).toBe('Placed')
    expect(summaries.trains).toBe('2 bought')
    expect(summaries.track).toBeUndefined()
})
