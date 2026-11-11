import { describe, expect, it } from 'vitest'
import { assertExists, calculateHexGeometry, HexOrientation } from '@tabletop/common'
import { Market1862 } from '@tabletop/1862'
import { MarketScenePadding, MarketZoneBannerHeight, marketGeometry } from '@tabletop/18xx-ui'
import { MapView1862 } from './mapView.js'
import { Presentation1862 } from './presentation.js'

describe('1862 board', () => {
    // A flat hex of radius 50 reaches 50 across and 43.3 up and down from its centre; every
    // area keeps 12 map units clear of it.
    const hexes = MapView1862.map.definition.locations.map(
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

    it('keeps every drawn market cell and the depot clear of every hex and each other', () => {
        const market = MapView1862.boardAreas?.market
        const depot = MapView1862.boardAreas?.depot
        assertExists(market, 'The board has a market area')
        assertExists(depot, 'The board has a depot area')
        const zones = Presentation1862.marketZones
        const banner = zones?.some((zone) => zone.banner) ? MarketZoneBannerHeight : 0
        const geometry = marketGeometry(Market1862, Presentation1862.marketCell, zones)
        const width = 2 * MarketScenePadding + geometry.width
        const height = 2 * MarketScenePadding + banner + geometry.height
        const scale = Math.min(market.width / width, market.height / height)
        const left = market.x + (market.width - width * scale) / 2
        for (const space of Market1862.spaces) {
            const x = left + (MarketScenePadding + geometry.columnLefts[space.column]) * scale
            const y =
                market.y + (MarketScenePadding + banner + space.row * geometry.cell.height) * scale
            const cellWidth = geometry.cell.width * scale
            const cellHeight = geometry.cell.height * scale
            expect(clear(x, y, cellWidth, cellHeight), space.id).toBe(true)
            expect(
                x + cellWidth < depot.x ||
                    x > depot.x + depot.width ||
                    y + cellHeight < depot.y ||
                    y > depot.y + depot.height,
                space.id
            ).toBe(true)
        }
        expect(clear(depot.x, depot.y, depot.width, depot.height)).toBe(true)
    })

    it('draws the market at least as large as 1833NE’s linear market', () => {
        const market = MapView1862.boardAreas?.market
        assertExists(market, 'The board has a market area')
        const geometry = marketGeometry(Market1862, Presentation1862.marketCell)
        const scale = Math.min(
            market.width / (2 * MarketScenePadding + geometry.width),
            market.height / (2 * MarketScenePadding + geometry.height)
        )
        expect(scale).toBeGreaterThanOrEqual(0.78)
    })
})
