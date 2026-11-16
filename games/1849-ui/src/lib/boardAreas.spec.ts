import { describe, expect, it } from 'vitest'
import { assertExists, calculateHexGeometry, HexOrientation } from '@tabletop/common'
import { Market1849 } from '@tabletop/1849'
import {
    MarketScenePadding,
    marketGeometry
} from '../../../../libs/18xx-ui/src/lib/stock/marketTokenLayout.js'
import { MapView1849 } from './mapView.js'
import { Presentation1849 } from './presentation.js'

describe('1849 board', () => {
    it('keeps every drawn market cell, the depot and the start order clear of every hex and each other', () => {
        const areas = MapView1849.boardAreas
        expect(areas?.market && areas.depot).toBeTruthy()
        // A flat hex of radius 50 reaches 50 across and 43.3 up and down from its centre.
        const hexes = MapView1849.map.definition.locations.map(
            (location) =>
                calculateHexGeometry(
                    { orientation: HexOrientation.Flat, dimensions: { radius: 50 } },
                    location.coordinates
                ).center
        )
        const clear = (x: number, y: number, width: number, height: number) =>
            hexes.every(
                (hex) =>
                    x + width < hex.x - 62 ||
                    x > hex.x + 62 ||
                    y + height < hex.y - 55.3 ||
                    y > hex.y + 55.3
            )
        const geometry = marketGeometry(
            Market1849,
            Presentation1849.marketCell,
            Presentation1849.marketZones
        )
        const width = 2 * MarketScenePadding + geometry.width
        const height = 2 * MarketScenePadding + geometry.height
        const area = areas?.market
        const depot = areas?.depot
        assertExists(area, 'The board has a market area')
        assertExists(depot, 'The board has a depot area')
        const scale = Math.min(area.width / width, area.height / height)
        const left = area.x + (area.width - width * scale) / 2
        for (const space of Market1849.spaces) {
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
        const panel = areas?.panel
        assertExists(panel, 'The board has the start order panel')
        expect(clear(panel.x, panel.y, panel.width, panel.height)).toBe(true)
    })
})
