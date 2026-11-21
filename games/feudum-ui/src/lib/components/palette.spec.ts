// @vitest-environment node
import { readFileSync } from 'node:fs'
import { Color } from '@tabletop/common'
import { Goods, LocationKinds, RegionIds } from '@tabletop/feudum'
import { ColorblindColorizer } from '@tabletop/frontend-components'
import { describe, expect, it } from 'vitest'
import { FeudumGameColorizer } from '$lib/definitions/colorizer.js'
import { contrast, luminance, seatPaint } from '$lib/model/seatPaint.js'
import { plannedPalette } from '$lib/testing/artPlanPalette.js'

const planned = plannedPalette(
    readFileSync(new URL('../../../docs/art-plan.md', import.meta.url), 'utf8')
)
const declared = new Map(planned.map(({ token, light }) => [token, light]))

const SeatColors = [Color.Red, Color.Blue, Color.Yellow, Color.Green, Color.Purple]
const Colorizers = [
    { name: 'default', colorizer: new FeudumGameColorizer() },
    { name: 'colour-blind', colorizer: new ColorblindColorizer() }
]

function rgb(hex: string): number[] {
    return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
}

function distance(first: string, second: string): number {
    const other = rgb(second)
    return Math.hypot(...rgb(first).map((channel, index) => channel - other[index]))
}

/** The least sRGB distance two seats, or a seat and a role, may stand apart. */
const LeastDifference = 50

/** Contract, "Palette"; S71: the art plan's tokens, and the seats the colourizer's. */
describe('palette', () => {
    it('a token named from data has one for every value', () => {
        const named = [
            ...Goods.map((good) => `feudum-good-${good}`),
            ...LocationKinds.map((kind) => `feudum-disc-${kind}`),
            ...RegionIds.map((region) => `feudum-terrain-${region}`)
        ]
        expect(named.filter((token) => !declared.has(token))).toEqual([])
    })

    describe.each(Colorizers)('seat colours under the $name colorizer', ({ colorizer }) => {
        const fills = SeatColors.map((color) => colorizer.getUiColor(color))

        it('any two seats stand apart', () => {
            const close = fills.flatMap((fill, index) =>
                fills
                    .slice(index + 1)
                    .filter((other) => distance(fill, other) < LeastDifference)
                    .map((other) => `${fill} ${other}`)
            )
            expect(close).toEqual([])
        })

        it('no seat reads as danger', () => {
            const danger = declared.get('feudum-danger') ?? ''
            expect(fills.filter((fill) => distance(fill, danger) < LeastDifference)).toEqual([])
        })

        it('only yellow sits near accent: the lit ring stands over a halo, thicker than the edge', () => {
            const accent = declared.get('feudum-accent') ?? ''
            const yellow = colorizer.getUiColor(Color.Yellow)
            const near = fills.filter((fill) => distance(fill, accent) < LeastDifference)
            expect(near).toEqual([yellow])
        })

        it('ink on a seat fill has at least 4.5:1, from the seat paint alone', () => {
            const value = (ink: string) => {
                const hex = declared.get(ink.replace('var(--', '').replace(')', ''))
                return luminance(hex ?? '')
            }
            const poor = SeatColors.filter((color) => {
                const paint = seatPaint(
                    { getPlayerUiColor: () => colorizer.getUiColor(color) },
                    'seat',
                    'A'
                )
                return contrast(luminance(paint.fill), value(paint.ink)) < 4.5
            })
            expect(poor).toEqual([])
        })
    })

    it('a seat paint is the colourizer value, never a fixed one (S71)', () => {
        const paint = seatPaint({ getPlayerUiColor: (id) => `#00${id}` }, '00ff', 'A')
        expect(paint.fill).toBe('#0000ff')
    })
})
