import { describe, expect, it } from 'vitest'
import { render } from 'svelte/server'
import { StandardTileCatalog, type TileFace } from '@tabletop/18xx'
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

describe('track gauges', () => {
    const face: TileFace = {
        color: 'green',
        labels: [],
        nodes: [],
        paths: [
            {
                id: 'standard',
                endpoints: [
                    { kind: 'edge', edge: 0 },
                    { kind: 'edge', edge: 3 }
                ]
            },
            {
                id: 'narrow',
                endpoints: [
                    { kind: 'edge', edge: 1 },
                    { kind: 'edge', edge: 4 }
                ],
                gauge: 'narrow'
            },
            {
                id: 'dual',
                endpoints: [
                    { kind: 'edge', edge: 2 },
                    { kind: 'edge', edge: 5 }
                ],
                gauge: 'dual'
            }
        ]
    }
    const { body } = render(TileArtwork, {
        props: { face, drawing: createTileDrawing(face), appearance: ClassicTileAppearance }
    })
    const inkOf = (id: string) =>
        new RegExp(`<g data-path-id="${id}"[^>]*>(.*?)</g>`, 's').exec(body)?.[1] ?? ''
    const { ink, paper, trackWidth } = ClassicTileAppearance

    it('draws standard track as solid ink', () => {
        expect(inkOf('standard')).toContain(`stroke="${ink}"`)
        expect(inkOf('standard')).not.toContain('stroke-dasharray')
    })

    it('draws narrow track as dashes long enough to read when small', () => {
        expect(body).toContain('data-track-gauge="narrow"')
        expect(inkOf('narrow')).toContain(`stroke-dasharray="${1.5 * trackWidth} ${trackWidth}"`)
    })

    it('draws dual track as ink with a paper centre line', () => {
        expect(inkOf('dual')).toContain(`stroke="${ink}" stroke-width="${trackWidth}"`)
        expect(inkOf('dual')).toContain(`stroke="${paper}" stroke-width="${trackWidth * 0.4}"`)
    })

    it('patches a crossing with the over track’s gauge on a continuous band', () => {
        const crossings = [
            ...body.matchAll(/<g clip-path="[^"]*" data-track-crossing="(\w+)">(.*?)<\/g>/gs)
        ]
        expect(crossings.length).toBeGreaterThan(0)
        for (const [, over, patch] of crossings) {
            const band = /<path[^>]*>/.exec(patch)?.[0] ?? ''
            expect(band).not.toContain('stroke-dasharray')
            if (over === 'narrow') expect(patch).toContain('stroke-dasharray')
            if (over === 'dual')
                expect(patch).toContain(`stroke="${paper}" stroke-width="${trackWidth * 0.4}"`)
        }
        expect(crossings.map(([, over]) => over)).toContain('narrow')
    })
})
