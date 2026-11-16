import { CHICAGO_BONUS, cityIn, usaHex, type HexId } from '@tabletop/ride-the-rails'

/**
 * The board's look, one pick for each of twelve questions. The look is chosen here: to switch a
 * pick, change its line in `BOARD_LOOK`.
 *
 * `LOOK_OPTIONS` lists the options drawn so far. The other options considered, not drawn yet:
 * - palette: 'paper' (warm cream land, a soft blue sea with a coast line), 'prairie' (pale sage
 *   land, a cooler sea); a palette is a token block `[data-rtr-palette='<name>']` in
 *   `src/app.css`.
 * - startMark: 'ring' (a ring of start colours round a station disc), 'hex-side-bands' (one hex
 *   side per start colour); drawn in `CityLayer.svelte` beside `StartBand.svelte`.
 * - bonus: 'coin' (the amount on a round coin), 'numeral' (the figure alone with a halo); drawn
 *   in `CityLayer.svelte` beside `BonusPill.svelte`.
 * - piece: 'wood-cube' (an isometric wooden cube with shaded faces and grain); drawn in
 *   `RailroadPiece.svelte` beside `RailroadCube.svelte`.
 * - passenger: 'token' (a person on a white disc), 'navy-meeple' (the meeple in navy); drawn in
 *   `PassengerFigure.svelte`, placed and sized from `utils/cityMarks.ts`.
 * - startCue: 'flag' (a pennant of the colour on the city), 'ghost-cube' (a faint cube in the
 *   city); drawn in `StartCueLayer.svelte`.
 * - litRailroads: 'pip' (a lettered disc per railroad), 'inner-rings' (a ring per railroad
 *   inside the lit ring); drawn in `PickLayer.svelte`.
 * To add one, put its name in `LOOK_OPTIONS` and draw it where its pick is read.
 */
export const LOOK_OPTIONS = {
    /** 1. The land, sea, frame, city greys and the paper of the panels around the board. */
    palette: ['chart', 'mist'],
    /** 2. How a city shows the railroads that may start there. */
    startMark: ['band'],
    /** 3. Hex colouring: terrain only, every city one grey, or cities with printed starts lighter. */
    hexFill: ['terrain', 'city-tint', 'start-cities'],
    /** 4. The $5 and Chicago bonuses on their cities. */
    bonus: ['pill'],
    /** 5. Every railroad piece, on the map and off it: a flat rounded square. */
    piece: ['flat-square'],
    /** 6. A waiting passenger, and the outline it leaves once taken. */
    passenger: ['meeple'],
    /**
     * 7. The cities a newly available railroad could start in now: a dashed ring in its colour, or
     * its colour joining the city's start band where it is not printed.
     */
    startCue: ['dashed-band', 'band'],
    /** 8. Which railroads may build in a lit hex: a ghost cube each, or nothing (the ring alone). */
    litRailroads: ['ghost-cube', 'none'],
    /**
     * 9. How a lit hex stands out from the dimmed land: a hole in the scrim alone, the same hole in
     * a deeper scrim, a thin white ring inside its edge, a pale wash that lifts it, or a lit city
     * painted the plains' colour instead of its grey.
     */
    litHex: ['hole', 'deep-scrim', 'thin-ring', 'wash', 'plain-city'],
    /** 10. A city's middle: its grey throughout, or the plains' cream inside a rim of its grey. */
    cityCentre: ['grey', 'cream-inset'],
    /** 12. The board's edge: a navy frame, a thin navy line, a thin line in a deeper sea, or none. */
    mapFrame: ['navy', 'navy-thin', 'sea-line', 'none'],
    /** 13. A journey's start besides its navy ring: a pennant on a pole, a round badge, or nothing. */
    journeyStart: ['flag', 'badge', 'ring-only']
} as const

export type PaletteName = (typeof LOOK_OPTIONS.palette)[number]
export type StartMarkStyle = (typeof LOOK_OPTIONS.startMark)[number]
export type HexFillScheme = (typeof LOOK_OPTIONS.hexFill)[number]
export type BonusStyle = (typeof LOOK_OPTIONS.bonus)[number]
export type PieceStyle = (typeof LOOK_OPTIONS.piece)[number]
export type PassengerStyle = (typeof LOOK_OPTIONS.passenger)[number]
export type StartCueStyle = (typeof LOOK_OPTIONS.startCue)[number]
export type LitRailroadsStyle = (typeof LOOK_OPTIONS.litRailroads)[number]
export type LitHexStyle = (typeof LOOK_OPTIONS.litHex)[number]
export type CityCentreStyle = (typeof LOOK_OPTIONS.cityCentre)[number]
export type MapFrameStyle = (typeof LOOK_OPTIONS.mapFrame)[number]
export type JourneyStartStyle = (typeof LOOK_OPTIONS.journeyStart)[number]

export type BoardLook = {
    palette: PaletteName
    startMark: StartMarkStyle
    hexFill: HexFillScheme
    bonus: BonusStyle
    piece: PieceStyle
    passenger: PassengerStyle
    startCue: StartCueStyle
    litRailroads: LitRailroadsStyle
    litHex: LitHexStyle
    cityCentre: CityCentreStyle
    mapFrame: MapFrameStyle
    journeyStart: JourneyStartStyle
}

export const BOARD_LOOK: BoardLook = {
    palette: 'mist',
    startMark: 'band',
    hexFill: 'start-cities',
    bonus: 'pill',
    piece: 'flat-square',
    passenger: 'meeple',
    startCue: 'band',
    litRailroads: 'none',
    litHex: 'hole',
    cityCentre: 'cream-inset',
    mapFrame: 'sea-line',
    journeyStart: 'ring-only'
}

export type HexPaint = {
    fill: string
    /** The hex's edge: a thin warm grid round plain land, a pale line round a patch. */
    edge: string
    edgeWidth: number
}

const PLAIN_PAINT: HexPaint = {
    fill: 'var(--rtr-plain)',
    edge: 'var(--rtr-hex-edge)',
    edgeWidth: 0.9
}

/** BOARD_LOOK.cityCentre 'cream-inset': how far in from a city's edge its cream middle starts. */
export const CITY_CENTRE_INSET = 9

/** Mountains and cities fill the whole hex, edged in a pale line so each reads as a patch. */
function patch(fill: string): HexPaint {
    return { fill, edge: 'var(--rtr-patch-edge)', edgeWidth: 1.4 }
}

/** A hex's fill and edge in a hex colouring scheme. */
export function hexPaint(hexId: HexId, scheme: HexFillScheme = BOARD_LOOK.hexFill): HexPaint {
    const hex = usaHex(hexId)
    if (hex.terrain === 'mountain') return patch('var(--rtr-mountain)')
    const city = cityIn(hexId)
    if (!city || scheme === 'terrain') return PLAIN_PAINT
    if (scheme === 'city-tint') return patch('var(--rtr-hex-city)')
    // R-4.1.4, R-4.2: Chicago, which has no limit, apart; then the cities with printed starts.
    if (city.bonus === CHICAGO_BONUS.id) return patch('var(--rtr-hex-chicago)')
    if (city.startColours.length > 0) return patch('var(--rtr-hex-start-city)')
    return patch('var(--rtr-hex-city)')
}
