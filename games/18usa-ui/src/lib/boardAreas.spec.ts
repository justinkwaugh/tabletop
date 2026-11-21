import { describe, expect, it } from 'vitest'
import {
    assertExists,
    calculateHexGeometry,
    HexOrientation,
    type BoundingBox
} from '@tabletop/common'
import { EighteenUSAMarket } from '@tabletop/18usa'
import { LoanRateTableHeight, MarketScenePadding, marketGeometry } from '@tabletop/18xx-ui'
import { EighteenUSAMapView } from './mapView.js'
import { EighteenUSAPresentation } from './presentation.js'

describe('18USA board', () => {
    // A pointy hex of radius 50 reaches 43.3 across and 50 up and down from its centre; every
    // area keeps 12 map units clear of it.
    const hexes = EighteenUSAMapView.map.definition.locations.map(
        (location) =>
            calculateHexGeometry(
                { orientation: HexOrientation.Pointy, dimensions: { radius: 50 } },
                location.coordinates
            ).center
    )
    const clear = ({ x, y, width, height }: BoundingBox) =>
        hexes.every(
            (hex) =>
                x + width < hex.x - 55.3 ||
                x > hex.x + 55.3 ||
                y + height < hex.y - 62 ||
                y > hex.y + 62
        )
    const apart = (first: BoundingBox, second: BoundingBox) =>
        first.x + first.width < second.x ||
        first.x > second.x + second.width ||
        first.y + first.height < second.y ||
        first.y > second.y + second.height
    const market = EighteenUSAMapView.boardAreas?.market
    const depot = EighteenUSAMapView.boardAreas?.depot
    assertExists(market, 'The board has a market area')
    assertExists(depot, 'The board has a depot area')
    const geometry = marketGeometry(
        EighteenUSAMarket,
        EighteenUSAPresentation.marketCell,
        EighteenUSAPresentation.marketZones,
        { wraps: EighteenUSAPresentation.marketWraps }
    )
    const width = 2 * MarketScenePadding + geometry.width
    const marketHeight = 2 * MarketScenePadding + geometry.sceneHeight
    const height = marketHeight + LoanRateTableHeight

    it('draws the market and the loan strip below it at TOP’s scale', () => {
        expect(Math.min(market.width / width, market.height / height)).toBe(1)
    })

    it('keeps every market cell and the loan strip clear of every hex and the depot', () => {
        const left = market.x + (market.width - width) / 2
        const top = market.y + MarketScenePadding
        for (const space of EighteenUSAMarket.spaces) {
            const cell = {
                x: left + MarketScenePadding + geometry.columnLefts[space.column],
                y:
                    top +
                    geometry.lineTops[geometry.columnLines[space.column]] +
                    space.row * geometry.cell.height,
                width: geometry.cell.width,
                height: geometry.cell.height
            }
            expect(clear(cell), space.id).toBe(true)
            expect(apart(cell, depot), space.id).toBe(true)
        }
        const loans = { x: left, y: market.y + marketHeight, width, height: LoanRateTableHeight }
        expect(clear(loans)).toBe(true)
        expect(apart(loans, depot)).toBe(true)
    })

    it('keeps the depot clear of every hex', () => {
        expect(clear(depot)).toBe(true)
    })

    it('lies no wider than the market needs', () => {
        expect({ width: market.width, height: market.height }).toEqual({ width, height })
    })
})
