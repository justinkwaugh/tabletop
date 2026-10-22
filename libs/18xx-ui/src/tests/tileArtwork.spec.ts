import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import { StandardTileCatalog } from '@tabletop/18xx'
import TileArtwork from '../lib/tiles/TileArtwork.svelte'
import { createTileDrawing, TileRadius } from '../lib/tiles/tileDrawing.js'
import { ClassicTileAppearance } from '../lib/tiles/tileAppearance.js'

describe('tile artwork', () => {
    it('gives the hand-inked track a filter region covering the tile, not its bounding box', () => {
        // A straight laid edge to edge has no width.
        const tile = StandardTileCatalog.get('18xx:9')
        const { body } = render(TileArtwork, {
            props: {
                face: tile.face,
                drawing: createTileDrawing(tile.face),
                appearance: { ...ClassicTileAppearance, name: 'Inked', roughness: 1 }
            }
        })
        const trackFilterId = /<g fill="none"[^>]* filter="url\(#([^)]+)\)"/.exec(body)?.[1]
        expect(trackFilterId).toBeDefined()
        const filter = new RegExp(`<filter\\b[^>]*\\bid="${trackFilterId}"[^>]*>`).exec(body)?.[0]
        const attribute = (name: string) =>
            new RegExp(`\\b${name}="([^"]*)"`).exec(filter ?? '')?.[1]
        expect(attribute('filterUnits')).toBe('userSpaceOnUse')
        const x = Number(attribute('x'))
        const y = Number(attribute('y'))
        expect(x).toBeLessThan(-TileRadius)
        expect(y).toBeLessThan(-TileRadius)
        expect(x + Number(attribute('width'))).toBeGreaterThan(TileRadius)
        expect(y + Number(attribute('height'))).toBeGreaterThan(TileRadius)
    })
})
