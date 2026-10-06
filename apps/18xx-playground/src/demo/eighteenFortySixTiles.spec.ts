import { expect, it } from 'vitest'
import { assert, assertExists, HexOrientation } from '@tabletop/common'
import { EighteenFortySixTileSet } from '../../../../games/1846/src/tiles.js'
import { createTileDrawing } from '@tabletop/18xx-ui'
import { TileLayouts1846, MapView1846 } from '../../../../games/1846-ui/src/lib/mapView.js'

it('renders every supplied tile in the library and both board orientations', () => {
    for (const tile of EighteenFortySixTileSet.definitions)
        for (const orientation of [HexOrientation.Flat, HexOrientation.Pointy])
            for (const rotation of [0, 1, 2, 3, 4, 5] as const) {
                const drawing = createTileDrawing(
                    tile.face,
                    orientation,
                    rotation,
                    TileLayouts1846[tile.id]
                )
                expect(drawing.nodes).toHaveLength(tile.face.nodes.length)
                expect(drawing.paths).toHaveLength(tile.face.paths.length)
                if (['1846:298', '1846:299', '1846:300'].includes(tile.id))
                    expect(drawing.nodes.filter((node) => !node.revenueHidden)).toHaveLength(1)
            }
    expect(MapView1846.layouts?.['1846:298']).toEqual(TileLayouts1846['1846:298'])
})

it.each([
    ['1846:299', 70],
    ['1846:300', 90]
] as const)('preserves Chicago’s separate city positions on %s', (id, revenue) => {
    const tile = EighteenFortySixTileSet.definitions.find((tile) => tile.id === id)
    assertExists(tile)
    expect(MapView1846.layouts?.[tile.id]).toEqual(TileLayouts1846['1846:298'])
    for (const orientation of [HexOrientation.Flat, HexOrientation.Pointy]) {
        const drawing = createTileDrawing(tile.face, orientation, 0, TileLayouts1846[tile.id])
        expect(new Set(drawing.nodes.map(({ center }) => `${center.x},${center.y}`)).size).toBe(4)
        for (const { node, slots } of drawing.nodes) {
            assert(node.kind === 'city')
            expect(slots).toHaveLength(1)
            expect(node.revenue).toEqual({ kind: 'fixed', amount: revenue })
        }
    }
})
