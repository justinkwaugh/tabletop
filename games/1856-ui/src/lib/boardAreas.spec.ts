import { describe, expect, it } from 'vitest'
import { assertExists, calculateHexGeometry, HexOrientation } from '@tabletop/common'
import { Market1856 } from '@tabletop/1856'
import { MarketScenePadding, marketGeometry } from '@tabletop/18xx-ui'
import { MapView1856 } from './mapView.js'
import { Presentation1856 } from './presentation.js'

describe('1856 board', () => {
    it.each([['printed', Market1856]] as const)(
        'keeps every drawn %s market cell and the depot clear of every hex and each other',
        (_name, market) => {
            const areas = MapView1856.boardAreas
            expect(areas?.market && areas.depot).toBeTruthy()
            // A flat hex of radius 50 reaches 50 across and 43.3 up and down from its centre.
            const hexes = MapView1856.map.definition.locations.map(
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
                market,
                Presentation1856.marketCell,
                Presentation1856.marketZones
            )
            // Each market is drawn whole, at TOP's scale.
            const width = 2 * MarketScenePadding + geometry.width
            const height = 2 * MarketScenePadding + geometry.height
            const area = areas?.market
            const depot = areas?.depot
            assertExists(area, 'The board has a market area')
            assertExists(depot, 'The board has a depot area')
            const scale = Math.min(area.width / width, area.height / height)
            expect(scale).toBe(1)
            const left = area.x + (area.width - width * scale) / 2
            for (const space of market.spaces) {
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
        }
    )
})
