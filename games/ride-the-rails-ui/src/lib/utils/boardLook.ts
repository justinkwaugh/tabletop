import {
    CHICAGO_BONUS,
    cityIn,
    FIVE_DOLLAR_BONUS,
    usaHex,
    type HexId
} from '@tabletop/ride-the-rails'

/**
 * The board's look, one pick for each of six questions. The look is chosen here: to switch a
 * pick, change its line in `BOARD_LOOK`.
 *
 * `LOOK_OPTIONS` lists the options drawn so far. The other options considered, not drawn yet:
 * - palette: 'prairie' (pale sage land, a cooler sea), 'atlas' (near-white land, a navy coast);
 *   a palette is a token block `[data-rtr-palette='<name>']` in `src/app.css`.
 * - startMark: 'split-disc' (the station in wedges of the start colours), 'bunting' (lettered
 *   pennants over the station), 'hex-side-bands' (one hex side per start colour); drawn in
 *   `CityLayer.svelte` beside `StartRing.svelte`.
 * - bonus: 'banner' (a ribbon tag), 'numeral' (the figure alone with a halo); drawn in
 *   `CityLayer.svelte` beside `BonusCoin.svelte`.
 * - piece: 'top-down-block' (a square with a drop shadow); drawn in `RailroadPiece.svelte`.
 * - passenger: 'meeple' (pale wood), 'ticket' (a ticket with a person); drawn in
 *   `PassengerFigure.svelte`.
 * To add one, put its name in `LOOK_OPTIONS` and draw it where its pick is read.
 */
export const LOOK_OPTIONS = {
    /** 1. The land, sea, city tints and the paper of the panels around the board. */
    palette: ['paper'],
    /** 2. How a city shows the railroads that may start there. */
    startMark: ['ring'],
    /** 3. Hex colouring: terrain only, every city hex lighter, or city groups tinted too. */
    hexFill: ['terrain', 'city-tint', 'city-groups'],
    /** 4. The $5 and Chicago bonuses on their cities. */
    bonus: ['coin'],
    /** 5. Every railroad piece: an isometric cube in wood, or with flat faces. */
    piece: ['wood-cube', 'flat-cube'],
    /** 6. A waiting passenger, and the outline it leaves once taken. */
    passenger: ['figure']
} as const

export type PaletteName = (typeof LOOK_OPTIONS.palette)[number]
export type StartMarkStyle = (typeof LOOK_OPTIONS.startMark)[number]
export type HexFillScheme = (typeof LOOK_OPTIONS.hexFill)[number]
export type BonusStyle = (typeof LOOK_OPTIONS.bonus)[number]
export type PieceStyle = (typeof LOOK_OPTIONS.piece)[number]
export type PassengerStyle = (typeof LOOK_OPTIONS.passenger)[number]

export type BoardLook = {
    palette: PaletteName
    startMark: StartMarkStyle
    hexFill: HexFillScheme
    bonus: BonusStyle
    piece: PieceStyle
    passenger: PassengerStyle
}

export const BOARD_LOOK: BoardLook = {
    palette: 'paper',
    startMark: 'ring',
    hexFill: 'city-groups',
    bonus: 'coin',
    piece: 'wood-cube',
    passenger: 'figure'
}

export type HexPaint = {
    fill: string
    /** A rim just inside the hex's edge, for a tinted city. */
    rim?: string
    rimWidth?: number
}

const CITY_RIM_WIDTH = 2.2
const GROUP_RIM_WIDTH = 3.2

const CITY_PAINT: HexPaint = {
    fill: 'var(--rtr-hex-city)',
    rim: 'var(--rtr-hex-city-rim)',
    rimWidth: CITY_RIM_WIDTH
}

function groupPaint(token: string): HexPaint {
    return {
        fill: `var(--rtr-hex-${token})`,
        rim: `var(--rtr-hex-${token}-rim)`,
        rimWidth: GROUP_RIM_WIDTH
    }
}

/** A hex's fill, and a city's rim, in a hex colouring scheme. */
export function hexPaint(hexId: HexId, scheme: HexFillScheme = BOARD_LOOK.hexFill): HexPaint {
    const hex = usaHex(hexId)
    if (hex.terrain === 'mountain') return { fill: 'var(--rtr-mountain)' }
    const city = cityIn(hexId)
    if (!city || scheme === 'terrain') return { fill: 'var(--rtr-plain)' }
    if (scheme === 'city-tint') return CITY_PAINT
    // R-4.3: the coasts a Transcontinental line joins, Chicago's and the $5 bonuses.
    if (city.groups.includes('east-coast')) return groupPaint('east')
    if (city.groups.includes('west-coast')) return groupPaint('west')
    if (city.bonus === CHICAGO_BONUS.id) return groupPaint('chicago')
    if (city.bonus === FIVE_DOLLAR_BONUS.id) return groupPaint('five')
    return CITY_PAINT
}
