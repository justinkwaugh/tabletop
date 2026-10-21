import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import { StandardTileCatalog } from '@tabletop/18xx'
import TileArtwork from '../lib/tiles/TileArtwork.svelte'
import { createTileDrawing } from '../lib/tiles/tileDrawing.js'
import { ClassicTileAppearance } from '../lib/tiles/tileAppearance.js'

describe('tile artwork', () => {
    it('sizes the hand-inked filter in tile space so straight track keeps its region', () => {
        // A straight laid edge to edge is a line with no width; a filter region taken from
        // its bounding box is empty, and browsers then draw nothing at all.
        const tile = StandardTileCatalog.get('18xx:9')
        const { body } = render(TileArtwork, {
            props: {
                face: tile.face,
                drawing: createTileDrawing(tile.face),
                appearance: { ...ClassicTileAppearance, name: 'Inked', roughness: 1 }
            }
        })
        const filter = /<filter\b[^>]*>/.exec(body)?.[0] ?? ''
        const attribute = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(filter)?.[1]
        expect(attribute('filterUnits')).toBe('userSpaceOnUse')
        const x = Number(attribute('x'))
        const y = Number(attribute('y'))
        const width = Number(attribute('width'))
        const height = Number(attribute('height'))
        // The hex has radius 50 about the origin; track and displacement reach a little past it.
        expect(x).toBeLessThanOrEqual(-55)
        expect(y).toBeLessThanOrEqual(-55)
        expect(x + width).toBeGreaterThanOrEqual(55)
        expect(y + height).toBeGreaterThanOrEqual(55)
    })
})
