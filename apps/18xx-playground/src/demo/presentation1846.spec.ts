import { expect, it } from 'vitest'
import { Presentation1846 } from '../../../../games/1846-ui/src/lib/presentation.js'

it('shows all paired train faces, their prices and the trains that obsolete them', () => {
    expect(
        Presentation1846.phaseChart.trains.map(({ id, price, supplyId, rustTrainIds }) => ({
            id,
            price,
            supplyId,
            rustTrainIds
        }))
    ).toEqual([
        { id: '2', price: 80, supplyId: '2', rustTrainIds: ['5', '4/6'] },
        { id: '4', price: 180, supplyId: '4', rustTrainIds: ['6', '7/8'] },
        { id: '3/5', price: 160, supplyId: '4', rustTrainIds: ['6', '7/8'] },
        { id: '5', price: 500, supplyId: '5', rustTrainIds: [] },
        { id: '4/6', price: 450, supplyId: '5', rustTrainIds: [] },
        { id: '6', price: 800, supplyId: '6', rustTrainIds: [] },
        { id: '7/8', price: 900, supplyId: '6', rustTrainIds: [] }
    ])
    expect(
        Presentation1846.phaseChart.trains.find((train) => train.id === '2')?.rustNote
    ).toContain('once more')
})
