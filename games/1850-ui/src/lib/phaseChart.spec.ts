import { describe, expect, it } from 'vitest'
import { DieselPhaseChart, PhaseChart1850 } from './phaseChart.js'

describe('the phase charts', () => {
    const rustedBy = (chart: typeof PhaseChart1850, trainId: string) =>
        chart.trains.find((train) => train.id === trainId)?.rustTrainIds

    it('end a diesel game on D, which scraps the 4s and leaves the 5s', () => {
        expect(DieselPhaseChart.phases.map((phase) => phase.id)).toEqual([
            '2',
            '3',
            '4',
            '5',
            '6',
            'D'
        ])
        expect(rustedBy(DieselPhaseChart, '4')).toEqual(['D'])
        expect(rustedBy(DieselPhaseChart, '5')).toEqual([])
    })

    it('leave D out of a standard game', () => {
        expect(PhaseChart1850.phases.map((phase) => phase.id)).toEqual([
            '2',
            '3',
            '4',
            '5',
            '6',
            '8',
            '10',
            '12'
        ])
        expect(rustedBy(PhaseChart1850, '4')).toEqual(['8'])
    })
})
