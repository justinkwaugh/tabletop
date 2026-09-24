import { expect, it } from 'vitest'
import { Shikoku1889Phases, Shikoku1889TrainDepot } from './trains.js'

it('declares the 1889 phases', () => {
    expect(
        Shikoku1889Phases.phases.map((phase) => [
            phase.id,
            phase.tileColors.at(-1),
            phase.operatingRounds,
            phase.trainLimit
        ])
    ).toEqual([
        ['2', 'yellow', 1, 4],
        ['3', 'green', 2, 4],
        ['4', 'green', 2, 3],
        ['5', 'brown', 3, 2],
        ['6', 'brown', 3, 2],
        ['D', 'brown', 3, 2]
    ])
})

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
