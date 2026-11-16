import { describe, expect, it } from 'vitest'
import { TrainDepot1882, createTrainInventory1882, extraTrainId } from '@tabletop/1882'
import { phaseChart1882 } from './phaseChart.js'

const marksOn = (chart: ReturnType<typeof phaseChart1882>) =>
    chart.trains.flatMap((train) => (train.marks ?? []).map((mark) => [train.id, mark.label]))

describe('1882 phase chart', () => {
    it('marks the rebellion’s train until the rebellion, as the second once the SC adds one (§3, §7.1.2)', () => {
        const inventory = createTrainInventory1882()
        expect(
            marksOn(phaseChart1882({ rebellion: { definitionId: '4' }, trainInventory: inventory }))
        ).toEqual([['4', undefined]])
        const withExtra = {
            ...inventory,
            trains: [
                ...inventory.trains,
                { id: extraTrainId('4'), definitionId: '4', status: 'depot' as const }
            ]
        }
        expect(TrainDepot1882.remaining(withExtra, '4')).toBe(4)
        expect(
            marksOn(phaseChart1882({ rebellion: { definitionId: '4' }, trainInventory: withExtra }))
        ).toEqual([['4', '2nd']])
        expect(
            marksOn(
                phaseChart1882({
                    rebellion: { definitionId: '4', occurred: true },
                    trainInventory: inventory
                })
            )
        ).toEqual([])
    })
})
