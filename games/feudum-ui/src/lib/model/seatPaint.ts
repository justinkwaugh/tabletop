import type { Color } from '@tabletop/common'

/** A seat's paint for its pieces. Colours come only from the session's colourizer (S71). */
export interface SeatPaint {
    readonly fill: string
    readonly ink: string
    readonly edge: string
    readonly initial: string
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

function paintOfFill(fill: string, initial: string): SeatPaint {
    const lightness = luminance(fill)
    return {
        fill,
        ink: lightness > DarkInkAbove ? 'var(--feudum-halo)' : 'var(--feudum-text)',
        edge: lightness < LightEdgeBelow ? 'var(--feudum-good-iron-edge)' : 'var(--feudum-map-ink)',
        initial
    }
}

export function seatPaint(
    colors: { getPlayerUiColor(playerId?: string): string },
    playerId: string,
    initial: string
): SeatPaint {
    return paintOfFill(colors.getPlayerUiColor(playerId), initial)
}

/** What a colour with no seat behind it wears: a dummy Knight row (R-1.4-H1). */
const NoSeatInitial = '-'

export function colourPaint(
    colors: { getUiColor(color: Color): string },
    colour: Color
): SeatPaint {
    return paintOfFill(colors.getUiColor(colour), NoSeatInitial)
}
