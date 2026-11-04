import { describe, expect, it } from 'vitest'
import { assertExists, calculateHexGeometry, HexOrientation } from '@tabletop/common'
import { EighteenNinetyFourMarket } from '@tabletop/1894'
import {
    MarketScenePadding,
    marketGeometry
} from '../../../../libs/18xx-ui/src/lib/stock/marketTokenLayout.js'
import { EighteenNinetyFourMapView } from './mapView.js'
import { EighteenNinetyFourPresentation } from './presentation.js'

describe('1894 board', () => {
    it('keeps every drawn market cell and the depot clear of every hex and each other', () => {
        const areas = EighteenNinetyFourMapView.boardAreas
        // A pointy hex of radius 50 reaches 43.3 across and 50 up and down from its centre.
        const hexes = EighteenNinetyFourMapView.map.definition.locations.map(
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
            EighteenNinetyFourMarket,
            EighteenNinetyFourPresentation.marketCell,
            EighteenNinetyFourPresentation.marketZones
        )
        const width = 2 * MarketScenePadding + geometry.width
        const height = 2 * MarketScenePadding + geometry.height
        const area = areas?.market
        const depot = areas?.depot
        assertExists(area, 'The board has a market area')
        assertExists(depot, 'The board has a depot area')
        const scale = Math.min(area.width / width, area.height / height)
        const left = area.x + (area.width - width * scale) / 2
        for (const space of EighteenNinetyFourMarket.spaces) {
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
