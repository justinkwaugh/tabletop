import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { packageFile, packageRoot } from '$lib/testing/paletteSource.js'

const Generated = new Set([
    'node_modules',
    '.svelte-kit',
    'dist',
    'build',
    'bundle',
    'package',
    'test-results'
])
const AssetFile = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|bmp|woff2?|ttf|otf|eot)$/i
const TextFile = /\.(?:ts|js|mjs|cjs|svelte|css|html|json|md|txt)$/i

function filesUnder(folder: string): string[] {
    return readdirSync(join(packageRoot, folder), { withFileTypes: true }).flatMap((entry) => {
        const path = `${folder}${entry.name}`
        if (entry.isDirectory()) return Generated.has(entry.name) ? [] : filesUnder(`${path}/`)
        return [path]
    })
}

const packageFiles = filesUnder('')

const SvgHazards: Record<string, RegExp> = {
    script: /<script\b/i,
    'event attribute': /\son[a-z]+\s*=/i,
    foreignObject: /<foreignObject\b/i,
    'external reference': /(?:xlink:)?href\s*=\s*["'](?:[a-z][a-z0-9+.-]*:|\/\/)/i,
    'external stylesheet': /url\(\s*["']?(?:[a-z][a-z0-9+.-]*:|\/\/)/i
}

type WebpImage = { width: number; height: number; lossy: boolean; alpha: boolean }

function webpImage(data: Uint8Array): WebpImage {
    const fourCc = (at: number) => String.fromCharCode(...data.subarray(at, at + 4))
    const uint32 = (at: number) =>
        data[at] | (data[at + 1] << 8) | (data[at + 2] << 16) | (data[at + 3] << 24)
    expect(fourCc(0)).toBe('RIFF')
    expect(fourCc(8)).toBe('WEBP')
    const chunks = new Map<string, number>()
    for (let at = 12; at + 8 <= data.length; at += 8 + uint32(at + 4) + (uint32(at + 4) % 2)) {
        chunks.set(fourCc(at), at + 8)
    }
    const frame = chunks.get('VP8 ')
    if (frame === undefined) return { width: 0, height: 0, lossy: false, alpha: chunks.has('ALPH') }
    expect([...data.subarray(frame + 3, frame + 6)]).toEqual([0x9d, 0x01, 0x2a])
    return {
        width: (data[frame + 6] | (data[frame + 7] << 8)) & 0x3fff,
        height: (data[frame + 8] | (data[frame + 9] << 8)) & 0x3fff,
        lossy: true,
        alpha: chunks.has('ALPH')
    }
}

/** Art plan, Supplied assets and Cover: the title ships no image but its cover, and two fonts. */
describe('image coverage', () => {
    it('ships no image or font file but the cover, the display font and the serif', () => {
        expect(packageFiles.filter((path) => AssetFile.test(path)).sort()).toEqual([
            'src/lib/fonts/BigShouldersDisplay-Bold.woff2',
            'src/lib/fonts/RideTheRailsSerif-Bold.woff2',
            'src/lib/images/cover.webp'
        ])
    })

    it('draws the cover as an opaque 482 × 680 lossy WebP of at most 120 KB, as Bohrer’s other titles', () => {
        const cover = readFileSync(join(packageRoot, 'src/lib/images/cover.webp'))
        expect(cover.byteLength).toBeLessThanOrEqual(120 * 1024)
        expect(webpImage(cover)).toEqual({ width: 482, height: 680, lossy: true, alpha: false })
    })

    it('states beside the cover how it was made', () => {
        expect(packageFile('src/lib/images/README.md')).toContain('scripts/render-cover.mjs')
    })

    it('photographs the cover’s board from the table itself, in the board’s serif', () => {
        const script = packageFile('scripts/render-cover.mjs')
        expect(script).toMatch(/photographMap\(/)
        expect(script).toContain("tableFont('SerifFontFamily')")
    })

    it.each([
        ['BigShouldersDisplay-Bold.woff2', 'BigShouldersDisplay-OFL.txt'],
        ['RideTheRailsSerif-Bold.woff2', 'LibreBaskerville-OFL.txt']
    ])('ships %s as a small WOFF2 with its SIL Open Font License', (fontFile, licenceFile) => {
        const font = readFileSync(join(packageRoot, 'src/lib/fonts', fontFile))
        expect(String.fromCharCode(...font.subarray(0, 4))).toBe('wOF2')
        expect(font.byteLength).toBeLessThanOrEqual(24 * 1024)
        expect(packageFile(`src/lib/fonts/${licenceFile}`)).toContain(
            'SIL OPEN FONT LICENSE Version 1.1'
        )
    })

    it('embeds no base64 image anywhere', () => {
        const embedded = packageFiles
            .filter((path) => TextFile.test(path))
            .filter((path) => /data:image\/[a-z+]+;base64/i.test(packageFile(path)))
        expect(embedded).toEqual([])
    })

    it('draws no SVG with a script, event attribute, foreignObject or external reference', () => {
        const svgSources = packageFiles.filter(
            (path) => path.endsWith('.svg') || path === 'scripts/render-cover.mjs'
        )
        expect(svgSources).toContain('scripts/render-cover.mjs')
        const hazards = svgSources.flatMap((path) => {
            const source = packageFile(path)
            return Object.entries(SvgHazards)
                .filter(([, pattern]) => pattern.test(source))
                .map(([hazard]) => `${path}: ${hazard}`)
        })
        expect(hazards).toEqual([])
    })
})
