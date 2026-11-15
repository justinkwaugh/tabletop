import { describe, expect, it } from 'vitest'
import { assertExists, calculateHexGeometry, HexOrientation } from '@tabletop/common'
import { Map1870, Market1870, TileSet1870 } from '@tabletop/1870'
import { createMapDrawing } from '@tabletop/18xx-ui'
import {
    MarketScenePadding,
    marketGeometry
} from '../../../../libs/18xx-ui/src/lib/stock/marketTokenLayout.js'
import { MapView1870 } from './mapView.js'
import { Presentation1870 } from './presentation.js'

describe('1870 board', () => {
    const drawing = (markers: readonly { locationId: string; kind: string }[]) =>
        createMapDrawing(
            Map1870,
            { tileSet: TileSet1870, inventory: TileSet1870.createInventory(), markers },
            MapView1870
        )
    const entryFor = (scene: ReturnType<typeof drawing>, locationId: string) => {
        const entry = scene.locations.find((candidate) => candidate.location.id === locationId)
        if (!entry) throw new Error(`No hex ${locationId}`)
        return entry
    }

    it('puts the Southwest’s markers between its spikes, clear of each other', () => {
        const entry = entryFor(
            drawing([
                { locationId: 'N1', kind: 'destination:MKT' },
                { locationId: 'N1', kind: 'destination:ATSF' }
            ]),
            'N1'
        )
        const tokens = entry.revenueAnnotations.flatMap((mark) =>
            mark.kind === 'token' ? [{ id: mark.markerId, x: mark.x, y: mark.y }] : []
        )
        expect(tokens).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'destination:MKT', x: 27, y: 18 }),
                expect.objectContaining({ id: 'destination:ATSF', x: -2, y: 33 })
            ])
        )
        const home = entry.drawing.printedTokens[0].center
        expect(home.x).toBeCloseTo(27, 0)
        expect(home.y).toBeCloseTo(-18, 0)
    })

    it('keeps a port clear of the river', () => {
        const entry = entryFor(drawing([{ locationId: 'H17', kind: 'port' }]), 'H17')
        const port = entry.revenueAnnotations.find((mark) => mark.kind === 'symbol')
        if (!port) throw new Error('Memphis shows its port')
        const line = entry.printedLines[0]
        for (const point of line.points ?? [])
            expect(Math.hypot(point.x - port.x, point.y - port.y)).toBeGreaterThan(line.width / 2)
    })

    it('keeps every drawn market cell and the depot clear of every hex and each other', () => {
        const areas = MapView1870.boardAreas
        expect(areas?.market && areas.depot).toBeTruthy()
        // A pointy hex of radius 50 reaches 43.3 across and 50 up and down from its centre.
        const hexes = MapView1870.map.definition.locations.map(
            (location) =>
                calculateHexGeometry(
                    { orientation: HexOrientation.Pointy, dimensions: { radius: 50 } },
                    location.coordinates
                ).center
        )
        const clear = (x: number, y: number, width: number, height: number) =>
            hexes.every(
                (hex) =>
                    x + width < hex.x - 55.3 ||
                    x > hex.x + 55.3 ||
                    y + height < hex.y - 62 ||
                    y > hex.y + 62
            )
        const geometry = marketGeometry(
            Market1870,
            Presentation1870.marketCell,
            Presentation1870.marketZones
        )
        const width = 2 * MarketScenePadding + geometry.width
        const height = 2 * MarketScenePadding + geometry.height
        const area = areas?.market
        const depot = areas?.depot
        assertExists(area, 'The board has a market area')
        assertExists(depot, 'The board has a depot area')
        const scale = Math.min(area.width / width, area.height / height)
        const left = area.x + (area.width - width * scale) / 2
        for (const space of Market1870.spaces) {
            const x = left + (MarketScenePadding + geometry.columnLefts[space.column]) * scale
            const y = area.y + (MarketScenePadding + space.row * geometry.cell.height) * scale
            const cellWidth = geometry.cell.width * scale
            const cellHeight = geometry.cell.height * scale
            expect(clear(x, y, cellWidth, cellHeight)).toBe(true)
            expect(
                x + cellWidth < depot.x ||
                    x > depot.x + depot.width ||
                    y + cellHeight < depot.y ||
                    y > depot.y + depot.height
            ).toBe(true)
        }
        expect(clear(depot.x, depot.y, depot.width, depot.height)).toBe(true)
    })
})
