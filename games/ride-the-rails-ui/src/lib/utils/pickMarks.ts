import {
    FIVE_DOLLAR_BONUS,
    USA_CITIES,
    USA_HEXES,
    railroadsIn,
    usaCity,
    usaHex,
    type HexId,
    type RailroadId,
    type Track
} from '@tabletop/ride-the-rails'
import type {
    BoardOffer,
    BuildPopup,
    OfferMark,
    OfferedHex,
    RailroadChip
} from '$lib/model/boardOffer.js'
import type { JourneyPopup } from '$lib/model/journeyOffer.js'
import { BOARD_EXTENTS, FITTED_DESKTOP_SCALE, hexCenter, hexCorners } from './boardGeometry.js'
import { railroadNames, railroadStyle } from './railroadStyle.js'

/** The most rings, pips and marks grow on the board when the view is zoomed out. */
export const LARGEST_PICK_SCALE = 2

/**
 * Rings, pips and marks grow with the board as the view zooms in, so monograms become readable,
 * and below the fitted desktop scale keep that scale's screen size, up to twice their board size.
 */
export function pickScale(viewScale: number): number {
    return Math.min(LARGEST_PICK_SCALE, Math.max(1, FITTED_DESKTOP_SCALE / viewScale))
}

export type RingKind = 'lit' | 'start' | 'picked'

export type MarkTone = 'coin' | 'five' | 'gold' | 'cost'

export type MarkView = { tone: MarkTone; text: string; spoken: string }

export type PipView = { railroadId: RailroadId; hollow: boolean }

export type LitHexView = {
    hexId: HexId
    ring: RingKind
    pips: PipView[]
    marks: MarkView[]
    /** The button's accessible name: place and effect. */
    label: string
}

// R-4.3.1, R-4.3.2, R-4.3.3, R-3.2.4: one wordless mark per gain or cost.
export function markView(mark: OfferMark): MarkView {
    if (mark.kind === 'placement-limit') {
        return {
            tone: 'cost',
            text: `−${-mark.change}`,
            spoken: `lowers the limit by ${-mark.change}`
        }
    }
    const text = `$${mark.amount}`
    switch (mark.bonusId) {
        case 'bonus.usa.chicago':
            return { tone: 'coin', text, spoken: text }
        case 'bonus.usa.five-dollar':
            return { tone: 'five', text, spoken: text }
        case 'bonus.usa.transcontinental':
            return { tone: 'gold', text, spoken: `${text} Transcontinental` }
    }
}

/** A hex's name on the map: its city, or its terrain and place in the grid. */
// The eight compass points, counter-clockwise from east, as the board draws north up.
const COMPASS_POINTS = [
    'east',
    'north-east',
    'north',
    'north-west',
    'west',
    'south-west',
    'south',
    'south-east'
] as const

// Two hex-centre distances closer than this are a tie.
const DISTANCE_TIE = 1e-6

/**
 * A city by its name; a plain or mountain by the nearest city and the compass point it lies in from
 * it ("Mountain west of Denver"). A tie in distance goes to the city first in the map's table.
 */
export function placeName(hexId: HexId): string {
    const hex = usaHex(hexId)
    if (hex.terrain === 'city') {
        return usaCity(hex.cityId).name
    }
    const terrain = hex.terrain === 'mountain' ? 'Mountain' : 'Plain'
    const center = hexCenter(hexId)
    let nearest = USA_CITIES[0]
    let nearestDistance = Infinity
    for (const city of USA_CITIES) {
        const cityCenter = hexCenter(city.hexId)
        const distance = Math.hypot(center.x - cityCenter.x, center.y - cityCenter.y)
        if (distance < nearestDistance - DISTANCE_TIE) {
            nearest = city
            nearestDistance = distance
        }
    }
    const cityCenter = hexCenter(nearest.hexId)
    const angle = Math.atan2(cityCenter.y - center.y, center.x - cityCenter.x)
    const sector =
        (Math.round(angle / (Math.PI / 4)) + COMPASS_POINTS.length) % COMPASS_POINTS.length
    return `${terrain} ${COMPASS_POINTS[sector]} of ${nearest.name}`
}

/**
 * What the lit hexes mean: a build placement, a journey's start, or its next link. A journey being
 * extended keeps its start pressable (a press clears the draft) and may have a link popup open.
 */
export type PickContext =
    | { kind: 'build' }
    | { kind: 'journey-start' }
    | { kind: 'journey-extend'; startHexId: HexId; choosingHexId: HexId | undefined }

export const BUILD_PICK: PickContext = { kind: 'build' }

/** "Chicago: place Orange or Black, $2"; "Dallas: place Yellow or start Black, $5". */
export function litHexLabel(hex: OfferedHex, context: PickContext = BUILD_PICK): string {
    const place = placeName(hex.hexId)
    const railroads = railroadNames(hex.placements.map((placement) => placement.railroadId))
    if (context.kind === 'journey-start') {
        return `${place}: start a journey with its passenger`
    }
    if (context.kind === 'journey-extend') {
        return `${place}: link by ${railroads}`
    }
    const extensions = hex.placements.filter((placement) => !placement.isStart)
    const starts = hex.placements.filter((placement) => placement.isStart)
    const effects = [
        ...(extensions.length > 0
            ? [`place ${railroadNames(extensions.map((placement) => placement.railroadId))}`]
            : []),
        ...(starts.length > 0
            ? [`start ${railroadNames(starts.map((placement) => placement.railroadId))}`]
            : [])
    ].join(' or ')
    const marks = hex.marks.map((mark) => `, ${markView(mark).spoken}`).join('')
    return `${place}: ${effects}${marks}`
}

const MAP_ORDER: ReadonlyMap<HexId, number> = new Map(
    USA_HEXES.map((hex, index) => [hex.id, index])
)

function pickedHexId(offer: BoardOffer, context: PickContext): HexId | undefined {
    return context.kind === 'journey-extend' ? context.choosingHexId : offer.popup?.hexId
}

/**
 * The board offer's lit set as the pick layer draws it, in map order (the Tab order). A journey
 * being extended adds its picked start, which a press clears.
 */
export function litHexViews(offer: BoardOffer, context: PickContext = BUILD_PICK): LitHexView[] {
    const picked = pickedHexId(offer, context)
    const lit = offer.lit.map((hex): LitHexView => ({
        hexId: hex.hexId,
        ring: picked === hex.hexId ? 'picked' : hex.startOnly ? 'start' : 'lit',
        pips: hex.placements.map((placement) => ({
            railroadId: placement.railroadId,
            hollow: placement.isStart
        })),
        marks: hex.marks.map(markView),
        label: litHexLabel(hex, context)
    }))
    if (context.kind !== 'journey-extend') {
        return lit
    }
    const start: LitHexView = {
        hexId: context.startHexId,
        ring: 'picked',
        pips: [],
        marks: [],
        label: `${placeName(context.startHexId)}: the journey's start, clear the journey`
    }
    return [...lit.filter((view) => view.hexId !== start.hexId), start].sort(
        (a, b) => (MAP_ORDER.get(a.hexId) ?? 0) - (MAP_ORDER.get(b.hexId) ?? 0)
    )
}

/** The hex's corners pulled in towards its centre, for rings drawn inside the hex edge. */
export function insetHexPoints(hexId: HexId, inset: number): string {
    const center = hexCenter(hexId)
    return hexCorners(hexId)
        .map((corner) => {
            const dx = corner.x - center.x
            const dy = corner.y - center.y
            const factor = 1 - inset / Math.hypot(dx, dy)
            return `${(center.x + dx * factor).toFixed(1)},${(center.y + dy * factor).toFixed(1)}`
        })
        .join(' ')
}

function hexPath(hexId: HexId): string {
    return `M${hexCorners(hexId)
        .map((corner) => `${corner.x.toFixed(1)},${corner.y.toFixed(1)}`)
        .join('L')}Z`
}

/** The whole board, water and margin included, so everything under the scrim dims alike. */
export const BOARD_OUTLINE_PATH = `M${BOARD_EXTENTS.x},${BOARD_EXTENTS.y}h${BOARD_EXTENTS.width}v${BOARD_EXTENTS.height}h${-BOARD_EXTENTS.width}Z`

/** The scrim: the whole board with a hole at each lit hex, filled even-odd. */
export function scrimPath(holes: readonly HexId[]): string {
    return `${BOARD_OUTLINE_PATH}${holes.map(hexPath).join('')}`
}

export type SpotlightMode = 'none' | 'dim' | 'outline'

// Contract, Coexistence and precedence: a pick's scrim and lit set win; the spotlight then only
// outlines its railroad's track. With no pick, the scrim dims every other railroad.
export function spotlightMode(
    offer: BoardOffer,
    spotlightRailroadId: RailroadId | undefined
): SpotlightMode {
    if (!spotlightRailroadId) return 'none'
    return offer.scrim ? 'outline' : 'dim'
}

export type HexDetailPlace = 'beside' | 'side-panel'

// Contract, Coexistence and precedence: during a map pick the hex detail moves to the side panel,
// so it never covers the railroad popup.
export function hexDetailPlace(offer: BoardOffer): HexDetailPlace {
    return offer.scrim ? 'side-panel' : 'beside'
}

export type ChipNote =
    | { kind: 'pays'; amounts: MarkView[] }
    | { kind: 'start-uses-bonus'; amount: number }
    | { kind: 'gain'; amount: number }
    | { kind: 'none' }

// R-4.3.2-H1: a start in an empty $5 city uses the bonus up and pays nothing.
export function chipNote(track: Track, hexId: HexId, chip: RailroadChip): ChipNote {
    if (chip.bonuses.length > 0) {
        return {
            kind: 'pays',
            amounts: chip.bonuses.map((bonus) =>
                markView({ kind: 'bonus', bonusId: bonus.bonusId, amount: bonus.amount })
            )
        }
    }
    const hex = usaHex(hexId)
    if (
        chip.isStart &&
        hex.terrain === 'city' &&
        usaCity(hex.cityId).bonus === FIVE_DOLLAR_BONUS.id &&
        railroadsIn(track, hexId).length === 0
    ) {
        return { kind: 'start-uses-bonus', amount: FIVE_DOLLAR_BONUS.amount }
    }
    return { kind: 'none' }
}

export type ChoiceChip = {
    railroadId: RailroadId
    /** The chip's accessible name. */
    label: string
    /** Supply left, and whether it starts the railroad. */
    detail: string | undefined
    note: ChipNote
}

/** The railroad popup beside a picked hex: one chip per railroad that can act there. */
export type RailroadChoice = {
    hexId: HexId
    title: string
    chips: ChoiceChip[]
}

function noteText(note: ChipNote): string {
    switch (note.kind) {
        case 'pays':
            return `, pays ${note.amounts.map((mark) => mark.spoken).join(' and ')}`
        case 'start-uses-bonus':
            return `, pays nothing: a start uses up the $${note.amount}`
        case 'gain':
            return `, you +$${note.amount}`
        case 'none':
            return ''
    }
}

// R-3.2, R-4.2, R-4.3: each railroad's locomotive, supply left and what its placement pays.
export function buildChoice(track: Track, popup: BuildPopup): RailroadChoice {
    return {
        hexId: popup.hexId,
        title: `${placeName(popup.hexId)}: which railroad?`,
        chips: popup.chips.map((chip) => {
            const note = chipNote(track, popup.hexId, chip)
            const detail = `${chip.isStart ? 'start · ' : ''}${chip.supplyLeft} left`
            return {
                railroadId: chip.railroadId,
                label: `${chipLabel(chip)}, ${detail}${noteText(note)}`,
                detail,
                note
            }
        })
    }
}

// R-3.3.2: each railroad that can make the link, with what the journey would then pay the seat.
export function linkChoice(popup: JourneyPopup): RailroadChoice {
    return {
        hexId: popup.hexId,
        title: `${placeName(popup.hexId)}: which railroad?`,
        chips: popup.chips.map((chip) => {
            const note: ChipNote = { kind: 'gain', amount: chip.gain }
            return {
                railroadId: chip.railroadId,
                label: `Link by ${railroadStyle(chip.railroadId).name}${noteText(note)}`,
                detail: undefined,
                note
            }
        })
    }
}

export function chipLabel(chip: RailroadChip): string {
    const name = railroadStyle(chip.railroadId).name
    return chip.isStart ? `Start ${name}` : `Place ${name}`
}
