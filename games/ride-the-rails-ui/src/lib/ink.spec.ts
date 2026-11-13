import { describe, expect, it } from 'vitest'
import { contrastRatio, laidOver } from '$lib/testing/colourMetrics.js'
import { railroadNames, Themes, tokenValue } from '$lib/testing/paletteSource.js'
import { RideTheRailsSeatPalette } from '$lib/definitions/seatPalette.js'

/** Art plan, Seat colours and colour blindness: "Ink by contrast", at least 4.5:1. */
const MinInkContrast = 4.5

/**
 * Art plan, Palette: under the scrim a locomotive is dimmed, yet still told from the plain it
 * stands on by its fill or its edge.
 */
const MinScrimmedTrackContrast = 1.5

describe('ink', () => {
    it('measures contrast as WCAG does', () => {
        expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21)
        expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
    })

    it.each(Themes)(
        'gives every railroad monogram its contrast in the %s theme (R-1.1)',
        (theme) => {
            const weak = railroadNames()
                .map((name) => {
                    const fill = tokenValue(theme, `rtr-railroad-${name}`)
                    const ink = tokenValue(theme, `rtr-railroad-${name}-ink`)
                    return { name, ratio: contrastRatio(fill, ink) }
                })
                .filter(({ ratio }) => ratio < MinInkContrast)
                .map(({ name, ratio }) => `${name} ${ratio.toFixed(2)}:1`)
            expect(railroadNames()).toHaveLength(6)
            expect(weak).toEqual([])
        }
    )

    it('lays the scrim over colours as the screen does', () => {
        expect(laidOver('#ffffff', '#00000080')).toBe('#7f7f7f')
        expect(laidOver('#123456', '#abcdef')).toBe('#abcdef')
    })

    it.each(Themes)('keeps every railroad readable under the scrim in the %s theme', (theme) => {
        const scrim = tokenValue(theme, 'rtr-scrim')
        const plain = laidOver(tokenValue(theme, 'rtr-plain'), scrim)
        const faint = railroadNames()
            .map((name) => {
                // As railroadStyle draws it: a dark edge, but a light one on Black.
                const edge = tokenValue(theme, name === 'black' ? 'rtr-station' : 'rtr-halo')
                const fill = tokenValue(theme, `rtr-railroad-${name}`)
                const ratio = Math.max(
                    contrastRatio(laidOver(fill, scrim), plain),
                    contrastRatio(laidOver(edge, scrim), plain)
                )
                return { name, ratio }
            })
            .filter(({ ratio }) => ratio < MinScrimmedTrackContrast)
            .map(({ name, ratio }) => `${name} ${ratio.toFixed(2)}:1`)
        expect(faint).toEqual([])
    })

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
