import { expect, it } from 'vitest'
import { EighteenThirtyPhases, EighteenThirtyTrainDepot } from './trains.js'

it('starts each phase with its train and rusts 2s, 3s and 4s', () => {
    for (const phase of EighteenThirtyPhases.phases.slice(1))
        expect(EighteenThirtyPhases.phaseAfterPurchase('2', phase.id)).toBe(phase.id)
    const rustedBy = (phaseId: string) =>
        EighteenThirtyTrainDepot.definition.trains
            .filter((train) => EighteenThirtyPhases.rustTiming(phaseId, train.id))
            .map((train) => train.id)
    expect(rustedBy('3')).toEqual([])
    expect(rustedBy('4')).toEqual(['2'])
    expect(rustedBy('6')).toEqual(['2', '3'])
    expect(rustedBy('D')).toEqual(['2', '3', '4'])
})
