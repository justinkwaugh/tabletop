import { describe, expect, it } from 'vitest'
import { calculateHexGeometry, HexOrientation } from '@tabletop/common'
import { Market1833NE } from '@tabletop/1833ne'
import {
    MarketScenePadding,
    MarketZoneBannerHeight,
    marketGeometry
} from '../../../../libs/18xx-ui/src/lib/stock/marketTokenLayout.js'
import { MapView1833NE } from './mapView.js'
import { Presentation1833NE } from './presentation.js'

describe('1833NE board', () => {
    it('keeps every drawn market cell and the depot clear of every hex', () => {
        const areas = MapView1833NE.boardAreas
        expect(areas?.market && areas.depot).toBeTruthy()
        // A flat hex of radius 50 reaches 50 across and 43.3 up and down from its centre.
        const hexes = MapView1833NE.map.definition.locations.map(
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
        const zones = Presentation1833NE.marketZones
        const banner = zones?.some((zone) => zone.banner) ? MarketZoneBannerHeight : 0
        const geometry = marketGeometry(Market1833NE, Presentation1833NE.marketCell, zones)
        const width = 2 * MarketScenePadding + geometry.width
        const height = 2 * MarketScenePadding + banner + geometry.height
        const area = areas!.market!
        const scale = Math.min(area.width / width, area.height / height)
        const left = area.x + (area.width - width * scale) / 2
        for (const space of Market1833NE.spaces)
            expect(
                clear(
                    left + (MarketScenePadding + geometry.columnLefts[space.column]) * scale,
                    area.y +
                        (MarketScenePadding + banner + space.row * geometry.cell.height) * scale,
                    geometry.cell.width * scale,
                    geometry.cell.height * scale
                )
            ).toBe(true)
        const depot = areas!.depot!
        expect(clear(depot.x, depot.y, depot.width, depot.height)).toBe(true)
    })
})
