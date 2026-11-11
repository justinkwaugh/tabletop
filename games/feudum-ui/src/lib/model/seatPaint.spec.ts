// @vitest-environment node
import { Color } from '@tabletop/common'
import { ColorblindColorizer } from '@tabletop/frontend-components'
import { describe, expect, it } from 'vitest'
import { PrintedColours } from '$lib/art/assetMap.js'
import { FeudumGameColorizer } from '$lib/definitions/colorizer.js'
import { colourPaint, printedInk, seatPaint } from './seatPaint.js'

/** A session's colours with one seat in `colour`, shown through `colorizer`. */
function sessionColours(colour: Color, colorizer = new FeudumGameColorizer()) {
    return {
        getPlayerColor: () => colour,
        getPlayerUiColor: () => colorizer.getUiColor(colour),
        getUiColor: (color: Color) => colorizer.getUiColor(color)
    }
}

/**
 * The publisher printed its cards and pieces in five colours. A paint names the printed colour it
 * shows only while the seat's displayed fill is that colour's own, so a palette that changes the
 * fill (the colour-blind one) keeps the drawn pieces in the colour it chose.
 */
describe('a seat paint and the printed colours', () => {
    it('the five printed colours are the seat colours', () => {
        expect([...PrintedColours].sort()).toEqual(
            [Color.Red, Color.Blue, Color.Yellow, Color.Green, Color.Purple].sort()
        )
    })

    it.each(PrintedColours)(
        'a %s seat under the default palette shows its printed colour',
        (colour) => {
            expect(seatPaint(sessionColours(colour), 'seat', 'A').printed).toBe(colour)
            expect(colourPaint(sessionColours(colour), colour).printed).toBe(colour)
        }
    )

    it.each(PrintedColours)('a %s seat under the colour-blind palette is drawn', (colour) => {
        const colours = sessionColours(colour, new ColorblindColorizer())
        expect(seatPaint(colours, 'seat', 'A').printed).toBeUndefined()
        expect(colourPaint(colours, colour).printed).toBeUndefined()
    })

    it('a colour the publisher never printed is drawn', () => {
        expect(seatPaint(sessionColours(Color.Orange), 'seat', 'A').printed).toBeUndefined()
        expect(colourPaint(sessionColours(Color.Gray), Color.Gray).printed).toBeUndefined()
    })

    it('a fill that is not the colour’s own is drawn, whatever the colour says', () => {
        const colours = { getPlayerColor: () => Color.Red, getPlayerUiColor: () => '#123456' }
        expect(seatPaint(colours, 'seat', 'A').printed).toBeUndefined()
    })

    it('the initial on a print is dark only on the light yellow print, light on the four dark ones', () => {
        expect(printedInk(Color.Yellow)).toBe('var(--feudum-halo)')
        for (const colour of [Color.Red, Color.Blue, Color.Green, Color.Purple] as const) {
            expect(printedInk(colour)).toBe('var(--feudum-text)')
        }
    })

    it('colours that cannot say the seat’s colour give a drawn paint', () => {
        const colours = { getPlayerUiColor: () => new FeudumGameColorizer().getUiColor(Color.Red) }
        expect(seatPaint(colours, 'seat', 'A').printed).toBeUndefined()
    })
})
