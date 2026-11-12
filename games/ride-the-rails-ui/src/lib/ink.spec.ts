import { describe, expect, it } from 'vitest'
import { contrastRatio } from '$lib/testing/colourMetrics.js'
import { railroadNames, Themes, tokenValue } from '$lib/testing/paletteSource.js'
import { RideTheRailsSeatPalette } from '$lib/definitions/seatPalette.js'

/** Art plan, Seat colours and colour blindness: "Ink by contrast", at least 4.5:1. */
const MinInkContrast = 4.5

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
