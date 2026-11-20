import { Color } from '@tabletop/common'
import { FeudumColors, knightRows, type KnightRowOwner } from '@tabletop/feudum'
import { PrintedColours, type PrintedColour } from '$lib/art/assetMap.js'
import { FeudumGameColorizer } from '$lib/definitions/colorizer.js'
import type { SeatsAndRows } from './knightLanes.js'

/** A seat's own wooden pieces: an influence marker, a player disc, a reeve. */
export const SeatPieceKinds = ['marker', 'disc', 'reeve'] as const
export type SeatPieceKind = (typeof SeatPieceKinds)[number]

/** A seat's paint for its pieces. Colours come only from the session's colourizer (S71). */
export interface SeatPaint {
    readonly fill: string
    readonly ink: string
    readonly edge: string
    /**
     * Whose pieces these are, as their accessible names and tooltips begin: the seat's name
     * ("Ana's influence marker"), or the colour for a piece no seat stands behind ("red influence
     * marker", a dummy Knight row). No piece carries a letter: colour is told apart by this name
     * and, for those who need it, by the platform's colour-blind palette.
     */
    readonly owner: string
    /**
     * The publisher's printed colour this paint shows, so a card or piece may be its printed one.
     * Absent when the displayed fill is not that colour's own (another palette), so the drawn
     * piece keeps the colour the palette chose.
     */
    readonly printed?: PrintedColour
}

/** The palette the printed colours stand for: a fill the session shows that is not one of these is drawn. */
const PrintedPalette = new FeudumGameColorizer()

function printedColour(colour: Color | undefined, fill: string): PrintedColour | undefined {
    const printed = PrintedColours.find((one) => one === colour)
    return printed && PrintedPalette.getUiColor(printed).toLowerCase() === fill.toLowerCase()
        ? printed
        : undefined
}

function channel(value: number): number {
    const unit = value / 255
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
    const [red, green, blue] = [1, 3, 5].map((start) =>
        channel(parseInt(hex.slice(start, start + 2), 16))
    )
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** The WCAG contrast ratio of two relative luminances. */
export function contrast(first: number, second: number): number {
    const [light, dark] = first > second ? [first, second] : [second, first]
    return (light + 0.05) / (dark + 0.05)
}

/** Above this a seat fill takes dark ink; below it, light (the two halo and text tokens). */
const DarkInkAbove = 0.179
/** Near black needs a light edge to stay off the terrain. */
const LightEdgeBelow = 0.03

function paintOfFill(fill: string, owner: string, colour?: Color): SeatPaint {
    const lightness = luminance(fill)
    const printed = printedColour(colour, fill)
    return {
        fill,
        ink: lightness > DarkInkAbove ? 'var(--feudum-halo)' : 'var(--feudum-text)',
        edge: lightness < LightEdgeBelow ? 'var(--feudum-good-iron-edge)' : 'var(--feudum-map-ink)',
        owner,
        ...(printed ? { printed } : {})
    }
}

export function seatPaint(
    colors: {
        getPlayerUiColor(playerId?: string): string
        getPlayerColor?(playerId?: string): Color
    },
    playerId: string,
    name: string
): SeatPaint {
    return paintOfFill(
        colors.getPlayerUiColor(playerId),
        `${name}'s`,
        colors.getPlayerColor?.(playerId)
    )
}

/** What a colour with no seat behind it wears, a dummy Knight row (R-1.4-H1): named by its colour. */
export function colourPaint(
    colors: { getUiColor(color: Color): string },
    colour: Color
): SeatPaint {
    return paintOfFill(colors.getUiColor(colour), colour, colour)
}

/**
 * R-1.4-H1, Player relationships: the colour a dummy row and its supply pool are shown in. Its own
 * while no seat is displayed in it; else the first of the game's colours that no seat is displayed
 * in and no other dummy row keeps. A preferred colour can take a dummy row's colour, never its look.
 */
export function dummyColourShown(
    seatColours: readonly Color[],
    dummyColours: readonly Color[],
    dummy: Color
): Color {
    const taken = new Set<Color>(seatColours)
    const kept = dummyColours.filter((colour) => !taken.has(colour))
    if (kept.includes(dummy)) {
        return dummy
    }
    const spare = FeudumColors.filter((colour) => !taken.has(colour) && !kept.includes(colour))
    const moved = dummyColours.filter((colour) => taken.has(colour))
    return spare.at(moved.indexOf(dummy)) ?? dummy
}

/** The session's colours, as a dummy row's paint reads them. */
export interface DummyPaintColours {
    getPlayerColor(playerId?: string): Color
    getUiColor(color: Color): string
}

/** R-1.4-H1 A dummy row's paint, in a colour no seat is displayed in, and named by that colour. */
export function dummyPaint(
    colors: DummyPaintColours,
    state: SeatsAndRows,
    dummy: Color
): SeatPaint {
    const seats = state.players.map(({ playerId }) => colors.getPlayerColor(playerId))
    const dummies = knightRows(state).flatMap(({ row }) =>
        'dummyColour' in row.owner ? [row.owner.dummyColour] : []
    )
    return colourPaint(colors, dummyColourShown(seats, dummies, dummy))
}

/** R-1.4-H1 A Knight row's paint: its seat's, or its dummy colour's as shown. */
export function ownerPaint(
    owner: KnightRowOwner,
    paintOf: (playerId: string) => SeatPaint,
    colourPaintOf: (colour: Color) => SeatPaint
): SeatPaint {
    return 'playerId' in owner ? paintOf(owner.playerId) : colourPaintOf(owner.dummyColour)
}
