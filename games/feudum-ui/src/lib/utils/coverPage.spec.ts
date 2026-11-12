// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BoxFrontTitle, CoverSize, TitleMargin, coverPlacement, coverSvg } from './coverPage.js'

const token = (name: string) => `#${name.length.toString(16).padStart(6, '0')}`
const href = 'data:image/png;base64,AAAA'

/** The rulebook's cover page: its printed title lies between 55 % and 68 % down. */
const RulebookCover = { width: 613, height: 859 }
const RulebookTitle = { top: 0.55, bottom: 0.68 }

/** The box front, landscape, with FEUDUM printed across 58 % of its width. */
const BoxFront = { width: 2400, height: 1618 }

/** The parchment band and its title, which the cover script draws over a scene that has no title. */
const band = /<rect y="478"/
const title = />Feudum</

describe('the cover page', () => {
    it('a supplied scene without a title stands behind the title band', () => {
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

describe('the crop without a known title', () => {
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

    it('keeps the rulebook cover’s printed title whole on the cover', () => {
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

describe('the box front’s crop, around its printed title', () => {
    const placed = coverPlacement(BoxFront, BoxFrontTitle)
    const left = placed.x + BoxFrontTitle.left * placed.width
    const right = placed.x + BoxFrontTitle.right * placed.width

    it('keeps the printed title whole, clear of both sides by the margin', () => {
        expect(left).toBeGreaterThanOrEqual(TitleMargin - 1e-9)
        expect(right).toBeLessThanOrEqual(CoverSize.width - TitleMargin + 1e-9)
    })

    it('shows as much of the scene as the title allows: the title and its margins fill the width', () => {
        expect(right - left).toBeCloseTo(CoverSize.width - 2 * TitleMargin, 9)
        expect(placed.height / placed.width).toBeCloseTo(BoxFront.height / BoxFront.width, 9)
        expect(placed.x).toBeLessThan(0)
        expect(placed.x + placed.width).toBeGreaterThan(CoverSize.width)
    })

    it('centres the title across the cover and the image top to bottom', () => {
        expect((left + right) / 2).toBeCloseTo(CoverSize.width / 2, 9)
        expect(placed.y).toBeGreaterThan(0)
        expect(placed.y + placed.height - CoverSize.height).toBeCloseTo(-placed.y, 9)
    })

    it('fills the whole height when a narrower title would fit there', () => {
        const narrow = coverPlacement(BoxFront, { left: 0.45, right: 0.55 })
        expect(narrow.y).toBe(0)
        expect(narrow.height).toBe(CoverSize.height)
    })

    it('stops at the image’s edge when the title sits near one side', () => {
        const atEdge = coverPlacement(BoxFront, { left: 0.02, right: 0.12 })
        expect(atEdge.x).toBe(0)
    })

    it('draws the cover with the image where the crop puts it', () => {
        const svg = coverSvg(
            { kind: 'art', href, titled: true, size: BoxFront, title: BoxFrontTitle },
            token
        )
        expect(svg).toContain(`<image href="${href}" x="${placed.x}" y="${placed.y}"`)
        expect(svg).toContain(`fill="${token('surface')}"`)
    })
})
