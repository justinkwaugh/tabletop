import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CoralColors, CoralTiles } from '@tabletop/reef-encounter'
import {
    BoardImageUrls,
    CoralTileFaceUrls,
    OpenSeaImageUrl,
    PolypFaceUrls
} from '$lib/images/art.generated.js'

// A lossy WebP's size, from its VP8 frame header.
function webpSize(path: string): { width: number; height: number } {
    const bytes = readFileSync(new URL(`../images/${path.replace(/^\.\//, '')}`, import.meta.url))
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
    expect(bytes.toString('ascii', 8, 16)).toBe('WEBPVP8 ')
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff }
}

// In tests the image imports resolve to their source paths under src/lib/images.
const imagePath = (url: string) => url.slice(url.indexOf('/images/') + '/images/'.length)

describe('the official art', () => {
    it('has 80 polyp faces of each colour, 144 pixels square', () => {
        for (const color of CoralColors) {
            expect(PolypFaceUrls[color]).toHaveLength(80)
            expect(new Set(PolypFaceUrls[color]).size).toBe(80)
            for (const url of PolypFaceUrls[color]) {
                expect(webpSize(imagePath(url))).toEqual({ width: 144, height: 144 })
            }
        }
    })

    it('has both faces of every coral tile', () => {
        for (const tile of CoralTiles) {
            const faces = CoralTileFaceUrls[tile.id]
            for (const url of [faces.starfish, faces.plain]) {
                expect(webpSize(imagePath(url))).toEqual({ width: 199, height: 199 })
            }
        }
    })

    it('draws every board on the same grid, and the open-sea board at the same scale', () => {
        for (const url of Object.values(BoardImageUrls)) {
            expect(webpSize(imagePath(url))).toEqual({ width: 1143, height: 1397 })
        }
        expect(webpSize(imagePath(OpenSeaImageUrl))).toEqual({ width: 1575, height: 1143 })
    })
})
