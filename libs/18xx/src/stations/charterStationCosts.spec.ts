import { describe, expect, it } from 'vitest'
import type { Station } from '../map/station.js'
import { charterScheduleCost } from './charterStationCosts.js'
import type { StationPlacementContext } from './stationPlacement.js'

const schedule = [0, 40, 100, 100, 100]
const placed = (id: string, locationId: string): Station => ({
    id,
    companyId: 'AG',
    status: 'placed',
    position: { locationId, nodeId: 'city', slot: 0 }
})
const waiting = (id: string): Station => ({ id, companyId: 'AG', status: 'available' })
const placement = (stationId: string): StationPlacementContext => ({
    companyId: 'AG',
    stationId,
    position: { locationId: 'D15', nodeId: 'city', slot: 0 },
    connected: true
})

describe('charterScheduleCost', () => {
    const charter = [placed('AG:1', 'D15'), waiting('AG:2'), waiting('AG:3'), waiting('AG:4')]

    it('shows each waiting token at the price its charter prints for it', () => {
        expect(
            ['AG:2', 'AG:3', 'AG:4'].map((id) => charterScheduleCost(charter, id, schedule))
        ).toEqual([40, 100, 100])
    })

    it('charges a placement the next price, whichever token is placed', () => {
        expect(charterScheduleCost(charter, 'AG:4', schedule, placement('AG:4'))).toBe(40)
    })
})
