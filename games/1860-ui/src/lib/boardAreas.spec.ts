import { describe, expect, it } from 'vitest'
import {
    assertExists,
    calculateHexGeometry,
    HexOrientation,
    type BoundingBox
} from '@tabletop/common'
import { Market1860 } from '@tabletop/1860'
import { MarketScenePadding, MarketZoneBannerHeight, marketGeometry } from '@tabletop/18xx-ui'
import { MapView1860 } from './mapView.js'
import { Presentation1860 } from './presentation.js'

describe('1860 board', () => {
    // A flat hex of radius 50 reaches 50 across and 43.3 up and down from its centre; every
    // area keeps 12 map units clear of it.
    const hexes = MapView1860.map.definition.locations.map(
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
    const areas = MapView1860.boardAreas

    it('draws every market cell at TOP’s scale, clear of every hex and the depot', () => {
        const market = areas?.market
        const depot = areas?.depot
        assertExists(market, 'The board has a market area')
        assertExists(depot, 'The board has a depot area')
        const zones = Presentation1860.marketZones
        const banner = zones?.some((zone) => zone.banner) ? MarketZoneBannerHeight : 0
        const geometry = marketGeometry(Market1860, Presentation1860.marketCell, zones)
        const width = 2 * MarketScenePadding + geometry.width
        const height = 2 * MarketScenePadding + banner + geometry.height
        expect(Math.min(market.width / width, market.height / height)).toBe(1)
        const left = market.x + (market.width - width) / 2
        for (const space of Market1860.spaces) {
            const cell = {
                x: left + MarketScenePadding + geometry.columnLefts[space.column],
                y: market.y + MarketScenePadding + banner + space.row * geometry.cell.height,
                width: geometry.cell.width,
                height: geometry.cell.height
            }
            expect(clear(cell), space.id).toBe(true)
            expect(apart(cell, depot), space.id).toBe(true)
        }
    })

    it('keeps the depot clear of every hex', () => {
        const depot = areas?.depot
        assertExists(depot, 'The board has a depot area')
        expect(clear(depot)).toBe(true)
    })

    it('keeps the company layers clear of every hex and the depot', () => {
        const panel = areas?.panel
        const depot = areas?.depot
        assertExists(panel, 'The board has a panel area')
        assertExists(depot, 'The board has a depot area')
        expect(clear(panel)).toBe(true)
        expect(apart(panel, depot)).toBe(true)
    })
})
