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
    const drawn = (reservationInitials: boolean) =>
        render(MapScene, {
            props: {
                scene,
                stationAppearances: MapView1846.stations,
                reservations: [
                    { companyId: 'NYC', locationId: 'D20', nodeId: 'city' },
                    { companyId: 'ERIE', locationId: 'D20', nodeId: 'city' },
                    { companyId: 'B&O', locationId: 'H12', nodeId: 'city' }
                ],
                placementPreviews: [{ companyId: 'PRR', locationId: 'D6', nodeId: 'city-3' }],
                reservationInitials
            }
        }).body
    const reservationIn = (body: string, companyId: string) =>
        new RegExp(
            `<g[^>]*data-map-reservation="${companyId.replace('&', '&amp;')}"[^>]*>.*?</g>`,
            's'
        ).exec(body)?.[0]
    const body = drawn(false)
    const reservation = (companyId: string) => reservationIn(body, companyId)

    it('fades a home reservation in its colours', () => {
        expect(reservation('NYC')).toContain('faded')
        expect(reservation('NYC')).not.toContain('filter=')
    })

    it('greys a reservation that is not the company’s home, even in another company’s home city', () => {
        expect(reservation('ERIE')).toContain('filter="url(#')
        expect(reservation('ERIE')).not.toContain('faded')
        expect(reservation('B&O')).toContain('filter="url(#')
    })

    it('keeps a previewed placement in its colours', () => {
        expect(reservation('PRR')).toContain('faded')
        expect(reservation('PRR')).not.toContain('filter=')
    })

    describe('drawn as initials', () => {
        const initials = drawn(true)

        const mark = (companyId: string) => reservationIn(initials, companyId)

        it('draws every reservation as the company’s initials in black', () => {
            for (const [companyId, label] of [
                ['NYC', 'NYC'],
                ['ERIE', 'Erie'],
                ['B&O', 'B&amp;O']
            ]) {
                expect(mark(companyId)).toContain(`fill="#000000">${label}</text>`)
                expect(mark(companyId)).not.toContain('<image')
                expect(mark(companyId)).not.toContain('filter=')
            }
        })

        it('fades the initials of a reservation that is not the company’s home', () => {
            expect(mark('NYC')).not.toContain('faded')
            expect(mark('ERIE')).toContain('faded')
            expect(mark('B&O')).toContain('faded')
        })

        it('keeps a previewed placement as its token', () => {
            expect(mark('PRR')).toContain('faded')
            expect(mark('PRR')).not.toContain('fill="#000000"')
        })
    })
})
