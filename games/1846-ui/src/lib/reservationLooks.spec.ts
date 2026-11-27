import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import { createMapDrawing, MapScene } from '@tabletop/18xx-ui'
import { MapView1846 } from './mapView.js'

describe('reservation looks', () => {
    const scene = createMapDrawing(
        MapView1846.map,
        { tileSet: MapView1846.tileSet, inventory: MapView1846.tileSet.createInventory() },
        MapView1846
    )
    const { body } = render(MapScene, {
        props: {
            scene,
            stationAppearances: MapView1846.stations,
            reservations: [
                { companyId: 'NYC', locationId: 'D20', nodeId: 'city' },
                { companyId: 'ERIE', locationId: 'D20', nodeId: 'city' },
                { companyId: 'B&O', locationId: 'H12', nodeId: 'city' }
            ],
            placementPreviews: [{ companyId: 'PRR', locationId: 'D6', nodeId: 'city-3' }]
        }
    })
    const reservation = (companyId: string) =>
        new RegExp(`<g[^>]*data-map-reservation="${companyId.replace('&', '&amp;')}"[^>]*>`).exec(
            body
        )?.[0]

    it('fades a home reservation in its colours', () => {
        expect(reservation('NYC')).toContain('reserved-token')
        expect(reservation('NYC')).not.toContain('filter=')
    })

    it('greys a reservation that is not the company’s home, even in another company’s home city', () => {
        expect(reservation('ERIE')).toContain('filter="url(#')
        expect(reservation('ERIE')).not.toContain('reserved-token')
        expect(reservation('B&O')).toContain('filter="url(#')
    })

    it('keeps a previewed placement in its colours', () => {
        expect(reservation('PRR')).toContain('reserved-token')
        expect(reservation('PRR')).not.toContain('filter=')
    })
})
