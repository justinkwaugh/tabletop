// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CoverSize, coverSvg } from './coverPage.js'

const token = (name: string) => `#${name.length.toString(16).padStart(6, '0')}`
const scene = '<g id="drawn-scene"></g>'
const href = 'data:image/png;base64,AAAA'

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
        const svg = coverSvg({ kind: 'art', href, titled: true }, token)
        expect(svg).toContain(
            `<image href="${href}" width="${CoverSize.width}" height="${CoverSize.height}"`
        )
        expect(svg).not.toMatch(band)
        expect(svg).not.toMatch(title)
        expect(svg.match(/<(rect|path|circle|text)\b/g)).toBeNull()
    })
})
