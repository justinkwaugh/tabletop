import { expect, it } from 'vitest'
import { companyFocusLocations } from './companyFocusLocations.js'

it('focuses an unplaced company on its reserved home, then its actual stations', () => {
    expect(
        companyFocusLocations(
            {
                stations: [{ id: 'S:home', companyId: 'S', status: 'available' }],
                stationReservations: [{ companyId: 'S', locationId: 'home', nodeId: 'city' }]
            },
            'S'
        )
    ).toEqual(['home'])
    expect(
        companyFocusLocations(
            {
                stations: [
                    {
                        id: 'S:home',
                        companyId: 'S',
                        status: 'placed',
                        position: { locationId: 'first', nodeId: 'city', slot: 0 }
                    },
                    {
                        id: 'S:extra',
                        companyId: 'S',
                        status: 'placed',
                        position: { locationId: 'second', nodeId: 'city', slot: 0 }
                    }
                ],
                stationReservations: [{ companyId: 'S', locationId: 'home', nodeId: 'city' }]
            },
            'S'
        )
    ).toEqual(['first', 'second'])
})
