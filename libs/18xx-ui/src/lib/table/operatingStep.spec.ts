import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { historicalOperatingStepIndex, operatingStepIndex } from './operatingStep.js'

it('labels the recorded operation rather than the next decision', () => {
    const action = (type: string): GameAction => ({
        id: type, gameId: 'game', type, source: ActionSource.User
    })
    expect(historicalOperatingStepIndex(action('RunTrains'), 'DistributingEarnings')).toBe(2)
    expect(historicalOperatingStepIndex(action('DistributeEarnings'), 'BuyingTrains')).toBe(3)
    expect(historicalOperatingStepIndex(action('BuyTrain'), 'BuyingTrains')).toBe(4)
    expect(operatingStepIndex('DistributingEarnings')).toBe(3)
    expect(operatingStepIndex('BuyingTrains')).toBe(4)
})
