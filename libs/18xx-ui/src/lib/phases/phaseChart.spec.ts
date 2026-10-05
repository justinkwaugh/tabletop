import { expect, it } from 'vitest'
import { PhaseTable, TrainDepot } from '@tabletop/18xx'
import { createPhaseChart } from './phaseChart.js'

it('lists every face and price of paired certificates with one shared supply identity', () => {
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
        { id: '4', price: 180, supplyId: '4' },
        { id: '3/5', price: 160, supplyId: '4' }
    ])
})
