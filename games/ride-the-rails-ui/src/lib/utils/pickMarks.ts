import { assertExists, distanceAxial } from '@tabletop/common'
import {
    FIVE_DOLLAR_BONUS,
    USA_CITIES,
    USA_HEXES,
    doubledToAxial,
    hexCoordinates,
    hexOrder,
    railroadsIn,
    usaCity,
    cityIn,
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
import {
    BOARD_EXTENTS,
    FITTED_DESKTOP_SCALE,
    closedPath,
    hexCenter,
    hexCorners,
    pointText
} from './boardGeometry.js'
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

// The sixteen compass points, counter-clockwise from east, as the board draws north up. Every
// other one is a point of the eight-point compass.
const COMPASS_POINTS = [
    'east',
    'east-north-east',
    'north-east',
    'north-north-east',
    'north',
    'north-north-west',
    'north-west',
    'west-north-west',
    'west',
    'west-south-west',
    'south-west',
    'south-south-west',
    'south',
    'south-south-east',
    'south-east',
    'east-south-east'
] as const

// Two hex-centre distances closer than this are a tie.
const DISTANCE_TIE = 1e-6

const STEP_WORDS = ['one hex', 'two hexes', 'three hexes', 'four hexes', 'five hexes'] as const

type Bearing = { terrain: string; cityName: string; angle: number; steps: number }

function hexSteps(from: HexId, to: HexId): number {
    return distanceAxial(doubledToAxial(hexCoordinates(from)), doubledToAxial(hexCoordinates(to)))
}

// A plain or mountain from its nearest city; a tie in distance goes to the city first in the
// map's table.
function bearingOf(hexId: HexId, terrain: string): Bearing {
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
    return {
        terrain,
        cityName: nearest.name,
        angle: Math.atan2(cityCenter.y - center.y, center.x - cityCenter.x),
        steps: hexSteps(hexId, nearest.hexId)
    }
}

// Coarsest first: the eight-point compass, then the sixteen-point one, then that and the distance
// in hexes.
function bearingName({ terrain, cityName, angle, steps }: Bearing, fineness: number): string {
    const points = fineness === 0 ? 8 : 16
    const sector = (Math.round(angle / ((2 * Math.PI) / points)) + points) % points
    const point = COMPASS_POINTS[sector * (16 / points)]
    const distance = fineness >= 2 ? `${STEP_WORDS[steps - 1] ?? 'far'} ` : ''
    return `${terrain} ${distance}${point} of ${cityName}`
}

const FINEST = 2

// Each hex starts with its coarsest name; hexes that share a name all take the next finer one,
// until no two share.
function namePlaces(): ReadonlyMap<HexId, string> {
    const names = new Map<HexId, string>()
    const bearings = new Map<HexId, Bearing>()
    const fineness = new Map<HexId, number>()
    for (const hex of USA_HEXES) {
        if (hex.terrain === 'city') {
            names.set(hex.id, usaCity(hex.cityId).name)
            continue
        }
        const bearing = bearingOf(hex.id, hex.terrain === 'mountain' ? 'Mountain' : 'Plain')
        bearings.set(hex.id, bearing)
        fineness.set(hex.id, 0)
        names.set(hex.id, bearingName(bearing, 0))
    }
    for (let round = 0; round < FINEST; round++) {
        const holders = new Map<string, HexId[]>()
        for (const [hexId, name] of names) holders.set(name, [...(holders.get(name) ?? []), hexId])
        for (const hexIds of holders.values()) {
            if (hexIds.length < 2) continue
            for (const hexId of hexIds) {
                const bearing = bearings.get(hexId)
                const level = fineness.get(hexId)
                if (bearing === undefined || level === undefined || level >= FINEST) continue
                fineness.set(hexId, level + 1)
                names.set(hexId, bearingName(bearing, level + 1))
            }
        }
    }
    return names
}

const PLACE_NAMES = namePlaces()

/**
 * A hex's name on the map: a city by its name; a plain or mountain by the nearest city and the
 * compass point it lies in from it ("Mountain west of Denver"). Where two hexes would share a name,
 * both take a finer compass point, and then their distance in hexes as well ("Plain two hexes west
 * of Rapid City"), so no two hexes share one.
 */
export function placeName(hexId: HexId): string {
    const name = PLACE_NAMES.get(hexId)
    assertExists(name, `Unknown USA hex ${hexId}`)
    return name
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
        (a, b) => hexOrder(a.hexId) - hexOrder(b.hexId)
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
            return pointText({ x: center.x + dx * factor, y: center.y + dy * factor })
        })
        .join(' ')
}

function hexPath(hexId: HexId): string {
    return closedPath(hexCorners(hexId))
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

// Contract, Coexistence and precedence: during a map pick on wider screens the hex detail moves to
// the side panel beside the board, so it never covers the railroad popup. On phones the side panel
// is off screen, so the detail stays beside its hex and keeps clear of the popup there.
export function hexDetailPlace(offer: BoardOffer, onPhone: boolean): HexDetailPlace {
    return offer.scrim && !onPhone ? 'side-panel' : 'beside'
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
    if (
        chip.isStart &&
        cityIn(hexId)?.bonus === FIVE_DOLLAR_BONUS.id &&
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
            const supply = `${chip.supplyLeft} left`
            return {
                railroadId: chip.railroadId,
                // The label opens with "Start" already; the visible name does not.
                label: `${chipLabel(chip)}, ${supply}${noteText(note)}`,
                detail: chip.isStart ? `start · ${supply}` : supply,
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

function chipLabel(chip: RailroadChip): string {
    const name = railroadStyle(chip.railroadId).name
    return chip.isStart ? `Start ${name}` : `Place ${name}`
}
