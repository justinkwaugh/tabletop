import { describe, expect, it } from 'vitest'
import { splitQuantifiedPlannedDeliveryRow } from './plannedDeliveryRows.js'

describe('splitQuantifiedPlannedDeliveryRow', () => {
    it('splits a multi-good delivery into one row per good', () => {
        const rows = splitQuantifiedPlannedDeliveryRow({
            key: 'zone-1|city-a|ship-1|S01',
            zoneId: 'zone-1',
            cityId: 'city-a',
            quantity: 3,
            destinationLabel: 'Bandung',
            requiredQuantity: 0
        })

        expect(rows).toEqual([
            {
                key: 'zone-1|city-a|ship-1|S01:unit:0',
                zoneId: 'zone-1',
                cityId: 'city-a',
                quantity: 1,
                destinationLabel: 'Bandung',
                required: false,
                requiredQuantity: 0,
                unitIndex: 0
            },
            {
                key: 'zone-1|city-a|ship-1|S01:unit:1',
                zoneId: 'zone-1',
                cityId: 'city-a',
                quantity: 1,
                destinationLabel: 'Bandung',
                required: false,
                requiredQuantity: 0,
                unitIndex: 1
            },
            {
                key: 'zone-1|city-a|ship-1|S01:unit:2',
                zoneId: 'zone-1',
                cityId: 'city-a',
                quantity: 1,
                destinationLabel: 'Bandung',
                required: false,
                requiredQuantity: 0,
                unitIndex: 2
            }
        ])
    })

    it('marks only the required unit rows as required', () => {
        const rows = splitQuantifiedPlannedDeliveryRow({
            key: 'zone-1|city-a|ship-1|S01',
            zoneId: 'zone-1',
            cityId: 'city-a',
            quantity: 3,
            destinationLabel: 'Bandung',
            requiredQuantity: 2
        })

        expect(rows.map((row) => ({
            key: row.key,
            required: row.required,
            requiredQuantity: row.requiredQuantity
        }))).toEqual([
            {
                key: 'zone-1|city-a|ship-1|S01:unit:0',
                required: true,
                requiredQuantity: 1
            },
            {
                key: 'zone-1|city-a|ship-1|S01:unit:1',
                required: true,
                requiredQuantity: 1
            },
            {
                key: 'zone-1|city-a|ship-1|S01:unit:2',
                required: false,
                requiredQuantity: 0
            }
        ])
    })
})
