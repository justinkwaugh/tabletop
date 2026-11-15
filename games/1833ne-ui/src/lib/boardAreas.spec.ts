import { describe, expect, it } from 'vitest'
import { calculateHexGeometry, HexOrientation, type Point } from '@tabletop/common'
import { Market1833NE } from '@tabletop/1833ne'
import {
    MarketScenePadding,
    MarketZoneBannerHeight,
    marketGeometry
} from '../../../../libs/18xx-ui/src/lib/stock/marketTokenLayout.js'
import {
    bonusArrowHull,
    drawBonusArrow
} from '../../../../libs/18xx-ui/src/lib/maps/bonusArrows.js'
import { BonusArrows1833NE, MapView1833NE } from './mapView.js'
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

    it('prints each bonus arrow clear of the hexes and the others, but Albany/Troy’s on its blank red hex', () => {
        const geometry = { orientation: HexOrientation.Flat, dimensions: { radius: 50 } }
        const hexes = MapView1833NE.map.definition.locations.map((location) => ({
            id: location.id,
            corners: calculateHexGeometry(geometry, location.coordinates).vertices
        }))
        // Two convex outlines overlap unless a side of one has all of the other beyond it.
        const separates = (outline: readonly Point[], other: readonly Point[]) => {
            const middle = {
                x: outline.reduce((sum, point) => sum + point.x, 0) / outline.length,
                y: outline.reduce((sum, point) => sum + point.y, 0) / outline.length
            }
            return outline.some((corner, index) => {
                const next = outline[(index + 1) % outline.length]
                const side = (point: Point) =>
                    (next.x - corner.x) * (point.y - corner.y) -
                    (next.y - corner.y) * (point.x - corner.x)
                const inward = Math.sign(side(middle))
                return other.every((point) => side(point) * inward <= 0)
            })
        }
        const covered = Object.fromEntries(
            BonusArrows1833NE.map((arrow) => {
                const plate = bonusArrowHull(drawBonusArrow(arrow))
                const overlaps = hexes.filter(
                    ({ corners }) => !separates(corners, plate) && !separates(plate, corners)
                )
                return [arrow.id, overlaps.map((hex) => hex.id)]
            }).filter(([, ids]) => ids.length)
        )
        expect(covered).toEqual({ 'albany-troy-to-boston': ['A18'] })
        const plates = BonusArrows1833NE.map((arrow) => ({
            id: arrow.id,
            hull: bonusArrowHull(drawBonusArrow(arrow))
        }))
        const touching = plates.flatMap((plate, index) =>
            plates
                .slice(index + 1)
                .filter(
                    (other) =>
                        !separates(plate.hull, other.hull) && !separates(other.hull, plate.hull)
                )
                .map((other) => `${plate.id} ${other.id}`)
        )
        expect(touching).toEqual([])
    })
})
