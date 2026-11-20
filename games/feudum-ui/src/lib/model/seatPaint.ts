import { Color } from '@tabletop/common'
import {
    dummyRowColour,
    FeudumColors,
    knightRow,
    knightRows,
    type KnightRowId
} from '@tabletop/feudum'
import { PrintedColours, type PrintedColour } from '$lib/art/assetMap.js'
import { FeudumGameColorizer } from '$lib/definitions/colorizer.js'
import type { SeatsAndRows } from './knightLanes.js'

export const SeatPieceKinds = ['marker', 'disc', 'reeve'] as const
export type SeatPieceKind = (typeof SeatPieceKinds)[number]

/** S71 Colours come only from the session's colourizer. */
export interface SeatPaint {
    readonly fill: string
    readonly ink: string
    readonly edge: string
    /** No letter on a piece: this name and the platform's colour-blind palette tell seats apart. */
    readonly owner: string
    readonly printed?: PrintedColour
}

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

const DarkInkAbove = 0.179
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

/** R-1.4-H1 A colour with no seat behind it, a dummy Knight row, is named by its colour. */
export function colourPaint(
    colors: { getUiColor(color: Color): string },
    colour: Color
): SeatPaint {
    return paintOfFill(colors.getUiColor(colour), colour, colour)
}

/** R-1.4-H1 A preferred colour can take a dummy row's colour, never its look. */
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

export interface DummyPaintColours {
    getPlayerColor(playerId?: string): Color
    getUiColor(color: Color): string
}

/** R-1.4-H1 A dummy row's paint, in a colour no seat is displayed in. */
export function dummyPaint(
    colors: DummyPaintColours,
    state: SeatsAndRows,
    dummy: Color
): SeatPaint {
    const seats = state.players.map(({ playerId }) => colors.getPlayerColor(playerId))
    const dummies = knightRows(state).flatMap(({ rowId, row }) =>
        'dummy' in row.owner ? [dummyRowColour(state, rowId)] : []
    )
    return colourPaint(colors, dummyColourShown(seats, dummies, dummy))
}

/** R-1.4-H1 A Knight row's paint: its seat's, or its dummy colour's as shown. */
export function ownerPaint(
    state: SeatsAndRows,
    rowId: KnightRowId,
    paintOf: (playerId: string) => SeatPaint,
    colourPaintOf: (colour: Color) => SeatPaint
): SeatPaint {
    const { owner } = knightRow(state, rowId)
    return 'playerId' in owner
        ? paintOf(owner.playerId)
        : colourPaintOf(dummyRowColour(state, rowId))
}
