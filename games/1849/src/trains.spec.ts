import { describe, expect, it } from 'vitest'
import { Phases1849, TrainDepot1849, depotId1849, type CorporationCount1849 } from './trains.js'

function supply(corporations: CorporationCount1849): Record<string, number> {
    const inventory = TrainDepot1849.createInventory(depotId1849(corporations))
    const counts: Record<string, number> = {}
    for (const train of inventory.trains)
        counts[train.definitionId] = (counts[train.definitionId] ?? 0) + 1
    return counts
}

describe('the trains (§10.6)', () => {
    it('supply the roster for six corporations', () => {
        expect(supply(6)).toEqual({
            '4H': 4,
            '6H': 4,
            '8H': 3,
            '10H': 2,
            '12H': 1,
            '16H': 5,
            R6H: 2
        })
    })

    it('remove one 6H, one 8H and one 16H for five corporations (§2)', () => {
        expect(supply(5)).toEqual({
            '4H': 4,
            '6H': 3,
            '8H': 2,
            '10H': 2,
            '12H': 1,
            '16H': 4,
            R6H: 2
        })
    })

    it('eliminate the 4H, 6H and 8H with the first 8H, 10H and 16H', () => {
        expect(['4H', '6H', '8H'].map((id) => Phases1849.rustPhaseId(id))).toEqual([
            '8H',
            '10H',
            '16H'
        ])
        expect(TrainDepot1849.trainDefinition('16H')).toMatchObject({
            price: 1100,
            distance: { measure: 'hex-edges', maximum: 16 }
        })
    })
})

describe('the phases (§6)', () => {
    it('add tiles, rounds and limits as printed', () => {
        expect(
            Phases1849.phases.map(({ id, tileColors, operatingRounds, trainLimit }) => [
                id,
                tileColors.at(-1),
                operatingRounds,
                trainLimit
            ])
        ).toEqual([
            ['4H', 'yellow', 1, 4],
            ['6H', 'green', 2, 4],
            ['8H', 'green', 2, 3],
            ['10H', 'brown', 3, 2],
            ['12H', 'brown', 3, 2],
            ['16H', 'brown', 3, 2]
        ])
        expect(Phases1849.phaseAfterPurchase('16H', 'R6H')).toBe('16H')
    })
})
