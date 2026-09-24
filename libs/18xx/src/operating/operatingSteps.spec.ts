import { expect, it } from 'vitest'
import {
    BetweenCompaniesState,
    OperatingStepStates,
    isOperatingStep,
    stateAfterOperatingStep
} from './operatingSteps.js'

it('orders a company’s operating turn and returns between companies after the last step', () => {
    expect(OperatingStepStates.map((step) => stateAfterOperatingStep(step))).toEqual([
        'PlacingStation',
        'RunningTrains',
        'DistributingEarnings',
        'BuyingTrains',
        BetweenCompaniesState
    ])
    expect(isOperatingStep('RunningTrains')).toBe(true)
    expect(isOperatingStep('StockRound')).toBe(false)
    expect(isOperatingStep(BetweenCompaniesState)).toBe(false)
})

it('follows a longer list a title might declare', () => {
    const steps = ['RedeemingShares', ...OperatingStepStates, 'IssuingShares']
    expect(stateAfterOperatingStep('RedeemingShares', steps)).toBe('LayingTrack')
    expect(stateAfterOperatingStep('BuyingTrains', steps)).toBe('IssuingShares')
    expect(stateAfterOperatingStep('IssuingShares', steps)).toBe(BetweenCompaniesState)
    expect(isOperatingStep('IssuingShares', steps)).toBe(true)
    expect(() => stateAfterOperatingStep('IssuingShares')).toThrow('is not an operating step')
})
