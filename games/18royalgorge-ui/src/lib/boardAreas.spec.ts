import { describe, expect, it } from 'vitest'
import {
    assertExists,
    calculateHexGeometry,
    HexOrientation,
    type BoundingBox
} from '@tabletop/common'
import { MarketRoyalGorge } from '@tabletop/18royalgorge'
import {
    MarketScenePadding,
    MarketTabHeight,
    MarketZoneBannerHeight,
    marketGeometry
} from '@tabletop/18xx-ui'
import { MapViewRoyalGorge } from './mapView.js'
import { PresentationRoyalGorge } from './presentation.js'

describe('18RoyalGorge board', () => {
    // A flat hex of radius 50 reaches 50 across and 43.3 up and down from its centre; every
    // area keeps 12 map units clear of it.
    const hexes = MapViewRoyalGorge.map.definition.locations.map(
        (location) =>
            calculateHexGeometry(
                { orientation: HexOrientation.Flat, dimensions: { radius: 50 } },
                location.coordinates
            ).center
    )
    const clear = ({ x, y, width, height }: BoundingBox) =>
        hexes.every(
            (hex) =>
                x + width < hex.x - 62 ||
                x > hex.x + 62 ||
                y + height < hex.y - 55.3 ||
                y > hex.y + 55.3
        )
    const apart = (first: BoundingBox, second: BoundingBox) =>
        first.x + first.width < second.x ||
        first.x > second.x + second.width ||
        first.y + first.height < second.y ||
        first.y > second.y + second.height
    const areas = MapViewRoyalGorge.boardAreas

    it('draws every market cell at TOP’s scale, clear of every hex, the depot and the panel', () => {
        const market = areas?.market
        const depot = areas?.depot
        const panel = areas?.panel
        assertExists(market, 'The board has a market area')
        assertExists(depot, 'The board has a depot area')
        assertExists(panel, 'The board has a panel area')
        const zones = PresentationRoyalGorge.marketZones
        const banner = zones?.some((zone) => zone.banner) ? MarketZoneBannerHeight : 0
        const geometry = marketGeometry(MarketRoyalGorge, PresentationRoyalGorge.marketCell, zones)
        const width = 2 * MarketScenePadding + geometry.width
        // The debt marker hangs as a tab under the spaces.
        const height = 2 * MarketScenePadding + banner + geometry.height + MarketTabHeight
        expect(Math.min(market.width / width, market.height / height)).toBe(1)
        const left = market.x + (market.width - width) / 2
        for (const space of MarketRoyalGorge.spaces) {
            const cell = {
                x: left + MarketScenePadding + geometry.columnLefts[space.column],
                y: market.y + MarketScenePadding + banner + space.row * geometry.cell.height,
                width: geometry.cell.width,
                height: geometry.cell.height
            }
            expect(clear(cell), space.id).toBe(true)
            expect(apart(cell, depot), space.id).toBe(true)
            expect(apart(cell, panel), space.id).toBe(true)
        }
    })

    it('keeps the depot and the panel clear of every hex and each other', () => {
        const depot = areas?.depot
        const panel = areas?.panel
        assertExists(depot, 'The board has a depot area')
        assertExists(panel, 'The board has a panel area')
        expect(clear(depot)).toBe(true)
        expect(clear(panel)).toBe(true)
        expect(apart(depot, panel)).toBe(true)
    })
})
