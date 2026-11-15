import { describe, expect, it } from 'vitest'
import { contrastRatio, laidOver } from '$lib/testing/colourMetrics.js'
import { paletteNames, railroadNames, tokenValue } from '$lib/testing/paletteSource.js'
import { RideTheRailsSeatPalette } from '$lib/definitions/seatPalette.js'

/** Art plan, Seat colours and colour blindness: "Ink by contrast", at least 4.5:1 (WCAG AA). */
const MinInkContrast = 4.5

/** WCAG AA for the parts of a graphic a player must see: 3:1 against what is next to it. */
const MinGraphicContrast = 3

/**
 * Art plan, Palette: under the scrim a cube is dimmed, yet still told from the plain it stands
 * on by its fill or its edge.
 */
const MinScrimmedTrackContrast = 1.5

const Palettes = paletteNames()

function weakPairs(palette: string, pairs: readonly [string, string][], minimum: number) {
    return pairs
        .map(([ink, ground]) => ({
            pair: `${ink} on ${ground}`,
            ratio: contrastRatio(tokenValue(palette, ink), tokenValue(palette, ground))
        }))
        .filter(({ ratio }) => ratio < minimum)
        .map(({ pair, ratio }) => `${pair} ${ratio.toFixed(2)}:1`)
}

/** Every ground a city's name or mark is drawn on: the land it may spill onto and each city grey. */
const LabelGrounds = [
    'rtr-plain',
    'rtr-mountain',
    'rtr-hex-city',
    'rtr-hex-start-city',
    'rtr-hex-chicago'
]

describe('ink', () => {
    it('measures contrast as WCAG does', () => {
        expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21)
        expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
    })

    it('reads the palettes the stylesheet declares', () => {
        expect(Palettes).toContain('chart')
    })

    it.each(Palettes)(
        'gives every railroad letter its contrast in the %s palette (R-1.1)',
        (palette) => {
            const pairs = railroadNames().map((name): [string, string] => [
                `rtr-railroad-${name}-ink`,
                `rtr-railroad-${name}`
            ])
            expect(railroadNames()).toHaveLength(6)
            expect(weakPairs(palette, pairs, MinInkContrast)).toEqual([])
        }
    )

    it.each(Palettes)('gives the table and panel text AA in the %s palette', (palette) => {
        const pairs = ['rtr-table', 'rtr-panel', 'rtr-panel-raised'].flatMap(
            (ground): [string, string][] => [
                ['rtr-ink', ground],
                ['rtr-ink-muted', ground],
                ['rtr-pill', ground]
            ]
        )
        expect(
            weakPairs(palette, [...pairs, ['rtr-pill-ink', 'rtr-pill']], MinInkContrast)
        ).toEqual([])
    })

    it.each(Palettes)(
        'writes city names and East Coast capacities with AA in the %s palette',
        (palette) => {
            const pairs = LabelGrounds.map((ground): [string, string] => ['rtr-ink', ground])
            expect(weakPairs(palette, pairs, MinInkContrast)).toEqual([])
        }
    )

    it.each(Palettes)(
        'writes every bonus pill with AA, a used $5 too, in the %s palette',
        (palette) => {
            const pairs: [string, string][] = [
                ['rtr-coin-ink', 'rtr-coin'],
                ['rtr-five-ink', 'rtr-five'],
                ['rtr-coin-used-ink', 'rtr-coin-used']
            ]
            expect(weakPairs(palette, pairs, MinInkContrast)).toEqual([])
        }
    )

    it.each(Palettes)(
        'stands the passenger clear of every city ground in the %s palette',
        (palette) => {
            const pairs = LabelGrounds.map((ground): [string, string] => [
                'rtr-passenger-edge',
                ground
            ])
            expect(weakPairs(palette, pairs, MinGraphicContrast)).toEqual([])
        }
    )

    it.each(Palettes)('edges every cube clear of the land in the %s palette', (palette) => {
        // The edge is black at 55%, so it is measured as laid over each ground.
        const edge = tokenValue(palette, 'rtr-cube-edge')
        const weak = LabelGrounds.map((ground) => {
            const under = tokenValue(palette, ground)
            return { ground, ratio: contrastRatio(laidOver(under, edge), under) }
        })
            .filter(({ ratio }) => ratio < MinGraphicContrast)
            .map(({ ground, ratio }) => `${ground} ${ratio.toFixed(2)}:1`)
        expect(weak).toEqual([])
    })

    it('lays the scrim over colours as the screen does', () => {
        expect(laidOver('#ffffff', '#00000080')).toBe('#7f7f7f')
        expect(laidOver('#123456', '#abcdef')).toBe('#abcdef')
    })

    it.each(Palettes)(
        'keeps every railroad readable under the scrim in the %s palette',
        (palette) => {
            const scrim = tokenValue(palette, 'rtr-scrim')
            const plainColour = tokenValue(palette, 'rtr-plain')
            const plain = laidOver(plainColour, scrim)
            const edge = laidOver(
                laidOver(plainColour, tokenValue(palette, 'rtr-cube-edge')),
                scrim
            )
            const faint = railroadNames()
                .map((name) => {
                    const fill = tokenValue(palette, `rtr-railroad-${name}`)
                    const ratio = Math.max(
                        contrastRatio(laidOver(fill, scrim), plain),
                        contrastRatio(edge, plain)
                    )
                    return { name, ratio }
                })
                .filter(({ ratio }) => ratio < MinScrimmedTrackContrast)
                .map(({ name, ratio }) => `${name} ${ratio.toFixed(2)}:1`)
            expect(faint).toEqual([])
        }
    )

    it('gives every seat colour initials with their contrast (R-1.2)', () => {
        const weak = Object.entries(RideTheRailsSeatPalette)
            .map(([color, values]) => ({
                color,
                ratio: values ? contrastRatio(values.fill, values.text) : 0
            }))
            .filter(({ ratio }) => ratio < MinInkContrast)
            .map(({ color, ratio }) => `${color} ${ratio.toFixed(2)}:1`)
        expect(Object.keys(RideTheRailsSeatPalette)).toHaveLength(5)
        expect(weak).toEqual([])
    })
})
