// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CoverSize, coverPlacement, coverSvg } from './coverPage.js'

const token = (name: string) => `#${name.length.toString(16).padStart(6, '0')}`
const scene = '<g id="drawn-scene"></g>'
const href = 'data:image/png;base64,AAAA'

/** The placeholder, the rulebook's cover page: its printed title lies between 55 % and 68 % down. */
const RulebookCover = { width: 613, height: 859 }
const RulebookTitle = { top: 0.55, bottom: 0.68 }

/** The parchment band and its title, which the cover script draws over a scene that has no title. */
const band = /<rect y="478"/
const title = />Feudum</

describe('the cover page', () => {
    it('the drawn cover is the drawn scene under the title band', () => {
        const svg = coverSvg({ kind: 'drawn', markup: scene }, token)
        expect(svg).toContain(scene)
        expect(svg).toMatch(band)
        expect(svg).toMatch(title)
        expect(svg).not.toContain('<image')
    })

    it('a supplied scene without a title stands behind the same band', () => {
        const svg = coverSvg({ kind: 'art', href, titled: false }, token)
        expect(svg).toContain(`href="${href}"`)
        expect(svg).toMatch(band)
        expect(svg).toMatch(title)
    })

    it('a supplied cover that prints its own title is the whole cover, with nothing drawn over it', () => {
        const svg = coverSvg({ kind: 'art', href, titled: true, size: RulebookCover }, token)
        const { y, height } = coverPlacement(RulebookCover)
        expect(svg).toContain(
            `<image href="${href}" x="0" y="${y}" width="${CoverSize.width}" height="${height}"`
        )
        expect(svg).not.toMatch(band)
        expect(svg).not.toMatch(title)
        expect(svg.match(/<(rect|path|circle|text)\b/g)).toBeNull()
    })
})

describe('the box front’s crop', () => {
    it('scales the source to the cover’s full width and centres it top to bottom', () => {
        const placed = coverPlacement(RulebookCover)
        expect(placed.x).toBe(0)
        expect(placed.width).toBe(CoverSize.width)
        expect(placed.height / placed.width).toBeCloseTo(
            RulebookCover.height / RulebookCover.width,
            9
        )
        expect(placed.y).toBeLessThan(0)
        expect(placed.y + placed.height - CoverSize.height).toBeCloseTo(-placed.y, 9)
    })

    it('keeps the placeholder’s printed title whole on the cover', () => {
        const { y, height } = coverPlacement(RulebookCover)
        expect(y + RulebookTitle.top * height).toBeGreaterThanOrEqual(0)
        expect(y + RulebookTitle.bottom * height).toBeLessThanOrEqual(CoverSize.height)
    })

    it('stands a source wider than 4:5 whole between two bands of the page’s ground', () => {
        const square = { width: 1200, height: 1200 }
        expect(coverPlacement(square)).toEqual({
            x: 0,
            y: (CoverSize.height - CoverSize.width) / 2,
            width: CoverSize.width,
            height: CoverSize.width
        })
        const svg = coverSvg({ kind: 'art', href, titled: true, size: square }, token)
        expect(svg).toContain(`fill="${token('surface')}"`)
        expect(svg).not.toMatch(title)
    })
})
