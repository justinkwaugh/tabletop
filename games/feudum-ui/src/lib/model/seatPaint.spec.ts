// @vitest-environment node
import { Color } from '@tabletop/common'
import { ColorblindColorizer } from '@tabletop/frontend-components'
import { describe, expect, it } from 'vitest'
import { PrintedColours } from '$lib/art/assetMap.js'
import { FeudumGameColorizer } from '$lib/definitions/colorizer.js'
import { colourPaint, dummyColourShown, dummyPaint, seatPaint } from './seatPaint.js'

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
            expect(seatPaint(sessionColours(colour), 'seat', 'Ana').printed).toBe(colour)
            expect(colourPaint(sessionColours(colour), colour).printed).toBe(colour)
        }
    )

    it.each(PrintedColours)('a %s seat under the colour-blind palette is drawn', (colour) => {
        const colours = sessionColours(colour, new ColorblindColorizer())
        expect(seatPaint(colours, 'seat', 'Ana').printed).toBeUndefined()
        expect(colourPaint(colours, colour).printed).toBeUndefined()
    })

    it('a colour the publisher never printed is drawn', () => {
        expect(seatPaint(sessionColours(Color.Orange), 'seat', 'Ana').printed).toBeUndefined()
        expect(colourPaint(sessionColours(Color.Gray), Color.Gray).printed).toBeUndefined()
    })

    it('a fill that is not the colour’s own is drawn, whatever the colour says', () => {
        const colours = { getPlayerColor: () => Color.Red, getPlayerUiColor: () => '#123456' }
        expect(seatPaint(colours, 'seat', 'Ana').printed).toBeUndefined()
    })

    it('a seat paint names its seat, the start of every piece’s accessible name', () => {
        expect(seatPaint(sessionColours(Color.Red), 'seat', 'Ana').owner).toBe("Ana's")
    })

    it('a colour with no seat behind it is named by its colour (R-1.4-H1)', () => {
        expect(colourPaint(sessionColours(Color.Red), Color.Red).owner).toBe('red')
    })

    it('colours that cannot say the seat’s colour give a drawn paint', () => {
        const colours = { getPlayerUiColor: () => new FeudumGameColorizer().getUiColor(Color.Red) }
        expect(seatPaint(colours, 'seat', 'Ana').printed).toBeUndefined()
    })
})

/** Two seats in Red and Blue, beside two dummy rows; the viewer at the Red seat prefers Green. */
function preferringGreen() {
    const colorizer = new FeudumGameColorizer()
    const seats = { viewer: Color.Red, other: Color.Blue }
    const shown: Record<string, Color> = { viewer: Color.Green, other: Color.Blue }
    const state = {
        players: [
            { playerId: 'viewer', color: seats.viewer },
            { playerId: 'other', color: seats.other }
        ],
        guilds: {
            knight: {
                rows: {
                    'knight-row-1': { owner: { playerId: 'viewer' }, markers: 2 },
                    'knight-row-2': { owner: { playerId: 'other' }, markers: 2 },
                    'knight-row-3': { owner: { dummy: true }, markers: 2 },
                    'knight-row-4': { owner: { dummy: true }, markers: 2 }
                }
            }
        }
    } as unknown as Parameters<typeof dummyPaint>[1]
    const colours = {
        getPlayerColor: (playerId?: string) => shown[playerId ?? ''] ?? Color.Gray,
        getUiColor: (color: Color) => colorizer.getUiColor(color)
    }
    return { state, colours, colorizer }
}

describe('R-1.4-H1 a dummy row never wears a seat’s displayed colour', () => {
    it('2 seats Red and Blue, the viewer prefers Green: the green dummy row takes a free colour', () => {
        const { state, colours, colorizer } = preferringGreen()
        const seatFills = ['viewer', 'other'].map((id) =>
            colorizer.getUiColor(colours.getPlayerColor(id))
        )
        const green = dummyPaint(colours, state, Color.Green)
        const yellow = dummyPaint(colours, state, Color.Yellow)
        expect(seatFills).not.toContain(green.fill)
        expect(seatFills).not.toContain(yellow.fill)
        expect(green.fill).not.toBe(yellow.fill)
        expect(yellow.owner).toBe('yellow')
        expect(green.owner).toBe('red')
    })

    it('with no preferred colour every dummy row keeps its own', () => {
        expect(
            dummyColourShown([Color.Red, Color.Blue], [Color.Yellow, Color.Green], Color.Green)
        ).toBe(Color.Green)
    })

    it('two dummy rows pushed off their colours take different free ones', () => {
        const seats = [Color.Yellow, Color.Green]
        const dummies = [Color.Yellow, Color.Green]
        const shown = dummies.map((dummy) => dummyColourShown(seats, dummies, dummy))
        expect(new Set(shown).size).toBe(2)
        expect(shown.some((colour) => seats.includes(colour))).toBe(false)
    })
})
