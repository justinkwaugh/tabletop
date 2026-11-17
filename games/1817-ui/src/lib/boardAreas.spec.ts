import { describe, expect, it } from 'vitest'
import { assertExists, calculateHexGeometry, HexOrientation } from '@tabletop/common'
import { EighteenSeventeenMarket } from '@tabletop/1817'
import {
    LoanRateTableHeight,
    MarketScenePadding,
    MarketZoneBannerHeight,
    marketGeometry
} from '@tabletop/18xx-ui'
import { EighteenSeventeenMapView } from './mapView.js'
import { EighteenSeventeenPresentation } from './presentation.js'

describe('1817 board', () => {
    const areas = EighteenSeventeenMapView.boardAreas
    const area = areas?.market
    const depot = areas?.depot
    assertExists(area, 'The board has a market area')
    assertExists(depot, 'The board has a depot area')
    // A pointy hex of radius 50 reaches 43.3 across and 50 up and down from its centre.
    const hexes = EighteenSeventeenMapView.map.definition.locations.map(
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
        EighteenSeventeenMarket,
        EighteenSeventeenPresentation.marketCell,
        EighteenSeventeenPresentation.marketZones
    )
    const width = 2 * MarketScenePadding + geometry.width
    const marketHeight = 2 * MarketScenePadding + MarketZoneBannerHeight + geometry.height
    const height = marketHeight + LoanRateTableHeight
    const scale = Math.min(area.width / width, area.height / height)

    it('draws the market and the loan table below it across the area’s full width', () => {
        expect(scale).toBe(area.width / width)
    })

    it('keeps every drawn market cell, the loan table and the depot clear of every hex', () => {
        const left = area.x + (area.width - width * scale) / 2
        const top = area.y + (MarketScenePadding + MarketZoneBannerHeight) * scale
        for (const space of EighteenSeventeenMarket.spaces) {
            const x = left + (MarketScenePadding + geometry.columnLefts[space.column]) * scale
            const y = top + space.row * geometry.cell.height * scale
            expect(clear(x, y, geometry.cell.width * scale, geometry.cell.height * scale)).toBe(
                true
            )
        }
        expect(
            clear(left, area.y + marketHeight * scale, width * scale, LoanRateTableHeight * scale)
        ).toBe(true)
        expect(clear(depot.x, depot.y, depot.width, depot.height)).toBe(true)
    })
})
