import { describe, expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { TileCatalog1833NE } from '@tabletop/1833ne'
import { TileAppearances, createTileDrawing, tileDrawingStyle } from '@tabletop/18xx-ui'
import { TileLayouts1833NE } from './mapView.js'

describe('1833NE tile layouts', () => {
    it('keeps green Montreal’s two cities visibly apart in every tile style', () => {
        for (const appearance of TileAppearances) {
            const drawing = createTileDrawing(
                TileCatalog1833NE.get('1833ne:N25').face,
                HexOrientation.Flat,
                0,
                TileLayouts1833NE['1833ne:N25'],
                tileDrawingStyle(appearance)
            )
            const [double, single] = drawing.nodes
            const ring = appearance.cityRingWidth ?? 1.1
            const gaps = double.slots.map(
                (slot) =>
                    Math.hypot(slot.x - single.center.x, slot.y - single.center.y) -
                    double.slotRadius -
                    single.slotRadius -
                    2 * ring
            )
            expect(Math.min(...gaps)).toBeGreaterThan(2)
        }
    })
})
