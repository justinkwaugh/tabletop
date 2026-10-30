import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { RAILROAD_IDS, TOWN_TILE_KINDS } from '@tabletop/promontory-point'
import { UiDefinition } from '../definitions/definition.js'
import { mapImage } from './boardImages.js'
import { shareFaceImage } from './cardImages.js'
import { townTileImage } from './tileImages.js'

const imagesDir = fileURLToPath(new URL('.', import.meta.url))
const libDir = fileURLToPath(new URL('..', import.meta.url))
const packageDir = fileURLToPath(new URL('../../..', import.meta.url))

const GENERATED_DIRS = new Set([
    'node_modules',
    'build',
    'dist',
    'bundle',
    '.svelte-kit',
    'test-results'
])

function filesUnder(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
            return GENERATED_DIRS.has(entry.name) ? [] : filesUnder(path)
        }
        return [path]
    })
}

function posixRelative(from: string, path: string): string {
    return relative(from, path).split(sep).join('/')
}

interface WebpHeader {
    chunk: string
    width: number
    height: number
}

// A simple-format lossy WebP: one `VP8 ` chunk, no `VP8X` extension, so no alpha channel.
function webpHeader(bytes: Buffer): WebpHeader {
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF')
    expect(bytes.toString('ascii', 8, 12)).toBe('WEBP')
    return {
        chunk: bytes.toString('ascii', 12, 16),
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff
    }
}

interface ShippedImage {
    file: string
    width: number
    height: number
    maxBytes: number
    largestRender: { width?: number; height?: number }
}

const KB = 1000

// The art plan's "Supplied assets": natural size, byte ceiling and largest ordinary render (CSS px).
const SHIPPED: ShippedImage[] = [
    {
        file: 'board/map.webp',
        width: 3100,
        height: 1998,
        maxBytes: 800 * KB,
        largestRender: { width: 1550 }
    },
    ...['cp', 'up', 'kp', 'sp'].map((railroad) => ({
        file: `cards/share.${railroad}.webp`,
        width: 675,
        height: 1050,
        maxBytes: 70 * KB,
        largestRender: { width: 343 }
    })),
    ...[
        'price.plus-1',
        'price.plus-2',
        'price.plus-3',
        'price.minus-1',
        'price.minus-2',
        'price.minus-3',
        'red.dividend',
        'red.hammer'
    ].map((kind) => ({
        file: `tiles/tile.${kind}.webp`,
        width: 300,
        height: 300,
        maxBytes: 20 * KB,
        largestRender: { width: 160 }
    })),
    {
        file: 'cover.webp',
        width: 544,
        height: 680,
        maxBytes: 120 * KB,
        largestRender: { height: 340 }
    }
]

function lookupUrls(): string[] {
    return [
        mapImage().src,
        ...RAILROAD_IDS.map((railroadId) => shareFaceImage(railroadId).src),
        ...Object.values(TOWN_TILE_KINDS).map((kind) => townTileImage(kind.id).src),
        UiDefinition.info.thumbnailUrl
    ]
}

function imageFiles(): string[] {
    return filesUnder(imagesDir)
        .filter((path) => !/\.(ts|md)$/.test(path))
        .map((path) => posixRelative(imagesDir, path))
        .sort()
}

describe('image coverage', () => {
    it('R-1.1 — every railroad has its own share face', () => {
        const faces = RAILROAD_IDS.map((railroadId) => shareFaceImage(railroadId).src)
        expect(faces.every((src) => src.endsWith('.webp'))).toBe(true)
        expect(new Set(faces).size).toBe(RAILROAD_IDS.length)
    })

    it('R-1.1 — every town tile kind has its own face', () => {
        const kinds = Object.values(TOWN_TILE_KINDS)
        const faces = kinds.map((kind) => townTileImage(kind.id).src)
        expect(faces.every((src) => src.endsWith('.webp'))).toBe(true)
        expect(new Set(faces).size).toBe(kinds.length)
    })

    it('every image file is reached by a lookup or the cover, and every lookup names a file', () => {
        const urls = lookupUrls()
        const files = imageFiles()
        const orphans = files.filter((file) => !urls.some((url) => url.endsWith(`/images/${file}`)))
        const missing = urls.filter((url) => !files.some((file) => url.endsWith(`/images/${file}`)))
        expect(orphans).toEqual([])
        expect(missing).toEqual([])
    })

    it('R-X.4, O-7 — only the map, the faces and the cover ship; no back, no drawn stand-in', () => {
        expect(imageFiles()).toEqual(SHIPPED.map((image) => image.file).sort())
    })

    it('the lookups carry their files’ pixel sizes', () => {
        const sizeOf = (file: string) => {
            const { width, height } = webpHeader(readFileSync(join(imagesDir, file)))
            return { width, height }
        }
        expect(mapImage()).toMatchObject(sizeOf('board/map.webp'))
        for (const railroadId of RAILROAD_IDS) {
            const file = `cards/share.${railroadId.replace('railroad.', '')}.webp`
            expect(shareFaceImage(railroadId), railroadId).toMatchObject(sizeOf(file))
        }
        for (const kind of Object.values(TOWN_TILE_KINDS)) {
            expect(townTileImage(kind.id), kind.id).toMatchObject(sizeOf(`tiles/${kind.id}.webp`))
        }
    })

    describe.each(SHIPPED)('$file', (image) => {
        const path = join(imagesDir, image.file)

        it('is opaque lossy WebP at its natural size', () => {
            expect(webpHeader(readFileSync(path))).toEqual({
                chunk: 'VP8 ',
                width: image.width,
                height: image.height
            })
        })

        it('is within its byte ceiling', () => {
            expect(statSync(path).size).toBeLessThanOrEqual(image.maxBytes)
        })

        it('is within 2× its largest ordinary render', () => {
            const { width, height } = image.largestRender
            if (width !== undefined) expect(image.width).toBeLessThanOrEqual(2 * width)
            if (height !== undefined) expect(image.height).toBeLessThanOrEqual(2 * height)
        })
    })
})

describe('asset hygiene', () => {
    const sources = filesUnder(packageDir)

    it('no source image or resizing tool enters the package', () => {
        const rasters = sources.filter((path) => /\.(png|jpe?g|gif|tiff?|psd|bmp)$/i.test(path))
        // The harness's scenario generator writes JSON tables, not images.
        const tools = sources.filter(
            (path) =>
                /\.(py|sh|mjs|cjs)$/.test(path) &&
                posixRelative(packageDir, path) !== 'scripts/build-scenarios.mjs'
        )
        expect(rasters.map((path) => posixRelative(packageDir, path))).toEqual([])
        expect(tools.map((path) => posixRelative(packageDir, path))).toEqual([])
    })

    it('no file inlines an asset as a data: URI', () => {
        const inlined = filesUnder(libDir)
            .filter(
                (path) => /\.(svelte|ts|css|svg|html)$/.test(path) && !path.endsWith('.spec.ts')
            )
            .filter((path) => /\bdata:[a-z]+\/[\w.+-]+[;,]/i.test(readFileSync(path, 'utf8')))
        expect(inlined).toEqual([])
    })

    it('no SVG file carries script, an event attribute, foreignObject or an external reference', () => {
        const unsafe = sources
            .filter((path) => path.endsWith('.svg'))
            .filter((path) =>
                /<script|\son[a-z]+\s*=|<foreignObject|(?:xlink:)?href\s*=\s*["'](?!#)/i.test(
                    readFileSync(path, 'utf8')
                )
            )
        expect(unsafe).toEqual([])
    })

    it('the UI entry imports no image but the cover', () => {
        const entry = ['index.ts', 'definitions/definition.ts'].map((file) =>
            readFileSync(join(libDir, file), 'utf8')
        )
        const imageImports = entry.flatMap((source) => [
            ...source.matchAll(
                /from\s+['"]([^'"]+\.(?:webp|png|jpe?g|svg)|[^'"]*images\/[^'"]+)['"]/g
            )
        ])
        expect(imageImports.map((match) => match[1])).toEqual(['$lib/images/cover.webp'])
    })
})
