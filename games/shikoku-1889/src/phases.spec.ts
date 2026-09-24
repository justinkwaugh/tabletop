import { expect, it } from 'vitest'
import { Shikoku1889Phases, Shikoku1889TrainDepot } from './trains.js'

it('starts each phase with its train and rusts 2s, 3s and 4s', () => {
    for (const phase of Shikoku1889Phases.phases.slice(1))
        expect(Shikoku1889Phases.phaseAfterPurchase('2', phase.id)).toBe(phase.id)
    expect(Shikoku1889Phases.phaseAfterPurchase('5', '3')).toBe('5')
    const rustedBy = (phaseId: string) =>
        Shikoku1889TrainDepot.definition.trains
            .filter((train) => Shikoku1889Phases.rustTiming(phaseId, train.id))
            .map((train) => train.id)
    expect(rustedBy('3')).toEqual([])
    expect(rustedBy('4')).toEqual(['2'])
    expect(rustedBy('6')).toEqual(['2', '3'])
    expect(rustedBy('D')).toEqual(['2', '3', '4'])
})
