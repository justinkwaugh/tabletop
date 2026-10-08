import { expect, it } from 'vitest'
import { PhaseTable, TrainDepot } from '@tabletop/18xx'
import { createPhaseChart } from './phaseChart.js'

it('lists every face of paired certificates by price with one shared supply identity', () => {
    const depot = new TrainDepot({
        id: 'paired',
        trains: [
            {
                id: '4',
                name: '4',
                price: 180,
                distance: { measure: 'revenue-centers', maximum: 4 }
            },
            {
                id: '3/5',
                name: '3/5',
                price: 160,
                distance: { measure: 'revenue-centers', maximum: 5 }
            }
        ],
        supply: [{ definitionId: '4', variantDefinitionIds: ['3/5'], count: 4 }]
    })
    const phases = new PhaseTable(
        [{ id: 'II', startedBy: [], tileColors: ['yellow'], operatingRounds: 2, trainLimit: 4 }],
        depot
    )
    const chart = createPhaseChart({ phases, depot })
    expect(chart.trains.map(({ id, price, supplyId }) => ({ id, price, supplyId }))).toEqual([
        { id: '3/5', price: 160, supplyId: '4' },
        { id: '4', price: 180, supplyId: '4' }
    ])
})

const distance = (maximum: number) => ({ measure: 'revenue-centers' as const, maximum })
const depot = new TrainDepot({
    id: 'chart',
    trains: [
        { id: '2', name: '2', price: 80, distance: distance(2), rustsOn: '4' },
        { id: '4', name: '4', price: 300, distance: distance(4), rustsOn: '8' },
        { id: '8', name: '8', price: 800, distance: distance(8) },
        { id: 'D', name: 'D', price: 1100, distance: distance(99) }
    ],
    supply: [
        { definitionId: '2', count: 2 },
        { definitionId: '4', count: 2 },
        { definitionId: '8', count: 2 },
        { definitionId: 'D', count: 'unlimited' }
    ]
})
const phase = (id: string, startedBy: string[]) => ({
    id,
    startedBy,
    tileColors: ['yellow'],
    operatingRounds: 1,
    trainLimit: 4
})
const phases = new PhaseTable(
    [phase('2', []), phase('4', ['4']), phase('8', ['8']), phase('D', ['D'])],
    depot
)

it('leaves out a variant’s phases and trains and keeps its permanent trains', () => {
    const chart = createPhaseChart({
        phases,
        depot,
        omittedPhaseIds: ['8'],
        omittedTrainIds: ['8'],
        permanentTrainIds: ['2'],
        rustPhases: { '4': 'D' }
    })
    expect(chart.phases.map((entry) => entry.id)).toEqual(['2', '4', 'D'])
    expect(chart.trains.map((train) => [train.id, train.rustPhaseId])).toEqual([
        ['2', undefined],
        ['4', 'D'],
        ['D', undefined]
    ])
})
