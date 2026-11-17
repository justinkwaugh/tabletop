import { describe, expect, it } from 'vitest'
import { assertExists, calculateHexGeometry, HexOrientation } from '@tabletop/common'
import { Market1880 } from '@tabletop/1880'
import { MarketScenePadding, marketGeometry } from '@tabletop/18xx-ui'
import { MapView1880 } from './mapView.js'
import { Presentation1880 } from './presentation.js'

describe('1880 board', () => {
    it('keeps every drawn market cell and the depot clear of every hex and each other', () => {
        const areas = MapView1880.boardAreas
        // A pointy hex of radius 50 reaches 43.3 across and 50 up and down from its centre.
        const hexes = MapView1880.map.definition.locations.map(
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
            Market1880,
            Presentation1880.marketCell,
            Presentation1880.marketZones
        )
        const width = 2 * MarketScenePadding + geometry.width
        const height = 2 * MarketScenePadding + geometry.height
        const area = areas?.market
        const depot = areas?.depot
        assertExists(area, 'The board has a market area')
        assertExists(depot, 'The board has a depot area')
        const scale = Math.min(area.width / width, area.height / height)
        const left = area.x + (area.width - width * scale) / 2
        for (const space of Market1880.spaces) {
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
        // The operating order list below the depot, clear of the map and the depot.
        const panel = areas?.panel
        assertExists(panel, 'The board has the operating order panel')
        expect(clear(panel.x, panel.y, panel.width, panel.height)).toBe(true)
        expect(panel.y).toBeGreaterThan(depot.y + depot.height)
        // TOP's market scale: the cells at their natural size.
        expect(scale).toBeCloseTo(1)
    })
})
