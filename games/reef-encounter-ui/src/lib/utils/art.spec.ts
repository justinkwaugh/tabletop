import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CoralColors, CoralTiles } from '@tabletop/reef-encounter'
import {
    BoardImageUrls,
    CoralTileFaceUrls,
    OpenSeaImageUrl,
    PolypFaceUrls
} from '$lib/images/art.generated.js'

// A JPEG's size, from its first start-of-frame marker.
function jpegSize(path: string): { width: number; height: number } {
    const bytes = readFileSync(new URL(`../images/${path.replace(/^\.\//, '')}`, import.meta.url))
    expect(bytes.readUInt16BE(0)).toBe(0xffd8)
    let at = 2
    while (at < bytes.length) {
        const marker = bytes.readUInt16BE(at)
        const length = bytes.readUInt16BE(at + 2)
        if (marker >= 0xffc0 && marker <= 0xffc3) {
            return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) }
        }
        at += 2 + length
    }
    throw new Error(`${path} has no frame header`)
}

// In tests the image imports resolve to their source paths under src/lib/images.
const imagePath = (url: string) => url.slice(url.indexOf('/images/') + '/images/'.length)

describe('the official art', () => {
    it('has 80 polyp faces of each colour, 144 pixels square', () => {
        for (const color of CoralColors) {
            expect(PolypFaceUrls[color]).toHaveLength(80)
            expect(new Set(PolypFaceUrls[color]).size).toBe(80)
            for (const url of PolypFaceUrls[color]) {
                expect(jpegSize(imagePath(url))).toEqual({ width: 144, height: 144 })
            }
        }
    })

    it('has both faces of every coral tile', () => {
        for (const tile of CoralTiles) {
            const faces = CoralTileFaceUrls[tile.id]
            for (const url of [faces.starfish, faces.plain]) {
                expect(jpegSize(imagePath(url))).toEqual({ width: 199, height: 199 })
            }
        }
    })

    it('draws every board on the same grid, and the open-sea board at the same scale', () => {
        for (const url of Object.values(BoardImageUrls)) {
            expect(jpegSize(imagePath(url))).toEqual({ width: 1143, height: 1397 })
        }
        expect(jpegSize(imagePath(OpenSeaImageUrl))).toEqual({ width: 1575, height: 1143 })
    })
})
