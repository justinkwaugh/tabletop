import { assertExists, distanceAxial, type Point } from '@tabletop/common'
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
    FITTED_DESKTOP_SCALE,
    closedPath,
    hexCenter,
    hexCorners,
    pointText
} from './boardGeometry.js'
import { railroadNames, railroadStyle } from './railroadStyle.js'
import { ghostCubes, type GhostCube } from './trackLayout.js'

/** The most rings and marks grow on the board when the view is zoomed out. */
export const LARGEST_PICK_SCALE = 2

/**
 * Rings and marks grow with the board as the view zooms in, and below the fitted desktop scale
 * keep that scale's screen size, up to twice their board size.
 */
export function pickScale(viewScale: number): number {
    return Math.min(LARGEST_PICK_SCALE, Math.max(1, FITTED_DESKTOP_SCALE / viewScale))
}

/**
 * Contract, Pick conventions: a lit hex; one lit for a start only; the picked hex; and a journey's
 * start, a marker rather than a pick.
 */
export type RingKind = 'lit' | 'start' | 'picked' | 'journey-start'

export type MarkTone = 'coin' | 'five' | 'gold' | 'cost'

export type MarkView = { tone: MarkTone; text: string; spoken: string }

export type LitHexView = {
    hexId: HexId
    ring: RingKind
    /** For a build, each railroad that may go there, as a ghost cube in the slot it would take. */
    ghosts: GhostCube[]
    marks: MarkView[]
    /** For a journey's next city, each railroad that can make the link, as a chevron chip. */
    chevrons: RailroadId[]
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
 * being extended adds its start, ringed as a marker, which a press clears. A journey's lit cities
 * show no ghost cubes, their railroads' own cubes being already there; its next cities carry a
 * chevron per railroad that can make the link.
 */
export function litHexViews(
    offer: BoardOffer,
    track: Track,
    context: PickContext = BUILD_PICK
): LitHexView[] {
    const picked = pickedHexId(offer, context)
    const lit = offer.lit.map((hex): LitHexView => ({
        hexId: hex.hexId,
        ring: picked === hex.hexId ? 'picked' : hex.startOnly ? 'start' : 'lit',
        ghosts:
            context.kind === 'build'
                ? ghostCubes(
                      hex.hexId,
                      track,
                      hex.placements.map((placement) => placement.railroadId)
                  )
                : [],
        // A bonus the hex's own pill already shows (Chicago's $2, an untaken $5) is not marked
        // again; the hex's spoken name still says it.
        marks: hex.marks
            .filter((mark) => !(mark.kind === 'bonus' && cityIn(hex.hexId)?.bonus === mark.bonusId))
            .map(markView),
        chevrons:
            context.kind === 'journey-extend'
                ? hex.placements.map((placement) => placement.railroadId)
                : [],
        label: litHexLabel(hex, context)
    }))
    if (context.kind !== 'journey-extend') {
        return lit
    }
    const start: LitHexView = {
        hexId: context.startHexId,
        ring: 'journey-start',
        ghosts: [],
        marks: [],
        chevrons: [],
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

function pointKey(point: Point): string {
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`
}

/**
 * The land's outline: every hex side no two land hexes share, chained into closed loops, so the
 * land fills as one shape with no seams between hexes. Three hexes meet at each corner and any two
 * of them are neighbours, so each corner on the outline joins exactly two of its sides.
 */
function landOutline(): string {
    const sides = new Map<string, { from: Point; to: Point; count: number }>()
    for (const hex of USA_HEXES) {
        const corners = hexCorners(hex.id)
        corners.forEach((from, index) => {
            const to = corners[(index + 1) % corners.length]
            const key = [pointKey(from), pointKey(to)].sort().join(' ')
            const side = sides.get(key)
            if (side) side.count += 1
            else sides.set(key, { from, to, count: 1 })
        })
    }
    const points = new Map<string, Point>()
    const next = new Map<string, string[]>()
    for (const { from, to, count } of sides.values()) {
        if (count !== 1) continue
        const [a, b] = [pointKey(from), pointKey(to)]
        points.set(a, from)
        points.set(b, to)
        next.set(a, [...(next.get(a) ?? []), b])
        next.set(b, [...(next.get(b) ?? []), a])
    }
    const visited = new Set<string>()
    const loops: Point[][] = []
    for (const start of next.keys()) {
        if (visited.has(start)) continue
        const loop: Point[] = []
        let previous: string | undefined
        let current = start
        while (!visited.has(current)) {
            visited.add(current)
            const point = points.get(current)
            const ends = next.get(current)
            assertExists(point)
            assertExists(ends)
            const step = ends[0] === previous ? ends[1] : ends[0]
            assertExists(step)
            loop.push(point)
            previous = current
            current = step
        }
        loops.push(loop)
    }
    return loops.map(closedPath).join('')
}

const LAND_OUTLINE_PATH = landOutline()

/** The scrim: the land with a hole at each lit hex, filled even-odd; the sea is never dimmed. */
export function scrimPath(holes: readonly HexId[]): string {
    return `${LAND_OUTLINE_PATH}${holes.map(hexPath).join('')}`
}

/** A pill on a choice button: what that placement or link pays. */
export type ChipPill = { tone: MarkTone; text: string }

export type ChipModifiers = {
    /** Each bonus the placement pays (R-4.3.1, R-4.3.2), the Transcontinental apart. */
    bonuses: MarkView[]
    /** R-4.3.3: what completing the Transcontinental pays, if this placement does. */
    transcontinental: number | undefined
    /** R-4.3.2: a start in an empty $5 city uses the bonus up and pays nothing. */
    startUsesBonus: number | undefined
    /** R-3.2.4: the hex is the turn's first mountain, so the limit drops by one. */
    mountain: boolean
}

const TRANSCONTINENTAL_ID = 'bonus.usa.transcontinental'

// R-4.3, R-3.2.4: what the engine pays for this placement, and whether it lowers the limit.
export function chipModifiers(track: Track, popup: BuildPopup, chip: RailroadChip): ChipModifiers {
    const bonuses = chip.bonuses.filter((bonus) => bonus.bonusId !== TRANSCONTINENTAL_ID)
    const transcontinental = chip.bonuses.find((bonus) => bonus.bonusId === TRANSCONTINENTAL_ID)
    const usesBonus =
        chip.bonuses.length === 0 &&
        chip.isStart &&
        cityIn(popup.hexId)?.bonus === FIVE_DOLLAR_BONUS.id &&
        railroadsIn(track, popup.hexId).length === 0
    return {
        bonuses: bonuses.map((bonus) =>
            markView({ kind: 'bonus', bonusId: bonus.bonusId, amount: bonus.amount })
        ),
        transcontinental: transcontinental?.amount,
        startUsesBonus: usesBonus ? FIVE_DOLLAR_BONUS.amount : undefined,
        mountain: popup.lowersLimit
    }
}

export type ChoiceChip = {
    railroadId: RailroadId
    /** The button's accessible name: the whole choice in words. */
    label: string
    /** A pill only for what the placement earns. */
    pills: ChipPill[]
    /** A mountain mark: the placement lowers the turn's limit. */
    mountain: boolean
}

/** The railroad popup beside a picked hex: one button per railroad that can act there. */
export type RailroadChoice = {
    hexId: HexId
    /** The popup's accessible name; nothing in it is written out. */
    title: string
    chips: ChoiceChip[]
}

function modifierText(modifiers: ChipModifiers): string {
    const pays =
        modifiers.bonuses.length > 0
            ? `, pays ${modifiers.bonuses.map((mark) => mark.spoken).join(' and ')}`
            : modifiers.startUsesBonus !== undefined
              ? `, pays nothing: a start uses up the $${modifiers.startUsesBonus}`
              : ''
    const mountain = modifiers.mountain ? ', mountain: one fewer placement this turn' : ''
    const line =
        modifiers.transcontinental !== undefined
            ? `, completes the Transcontinental: pays $${modifiers.transcontinental}`
            : ''
    return `${pays}${mountain}${line}`
}

function chipPills(modifiers: ChipModifiers): ChipPill[] {
    return [
        ...modifiers.bonuses.map((mark) => ({ tone: mark.tone, text: `+${mark.text}` })),
        ...(modifiers.transcontinental !== undefined
            ? [{ tone: 'gold' as const, text: `+$${modifiers.transcontinental}` }]
            : [])
    ]
}

// R-3.2, R-4.2, R-4.3: each railroad's locomotive, supply left and what its placement pays.
export function buildChoice(track: Track, popup: BuildPopup): RailroadChoice {
    return {
        hexId: popup.hexId,
        title: `${placeName(popup.hexId)}: which railroad?`,
        chips: popup.chips.map((chip) => {
            const modifiers = chipModifiers(track, popup, chip)
            return {
                railroadId: chip.railroadId,
                // The label opens with "Start" already; nothing is written on the button.
                label: `${chipLabel(chip)}, ${chip.supplyLeft} left${modifierText(modifiers)}`,
                pills: chipPills(modifiers),
                mountain: modifiers.mountain
            }
        })
    }
}

// R-3.3.2: each railroad that can make the link, with what the journey would then pay the seat.
export function linkChoice(popup: JourneyPopup): RailroadChoice {
    return {
        hexId: popup.hexId,
        title: `${placeName(popup.hexId)}: which railroad?`,
        chips: popup.chips.map((chip) => ({
            railroadId: chip.railroadId,
            label: `Link by ${railroadStyle(chip.railroadId).name}, you +$${chip.gain}`,
            pills: chip.gain > 0 ? [{ tone: 'coin' as const, text: `+$${chip.gain}` }] : [],
            mountain: false
        }))
    }
}

function chipLabel(chip: RailroadChip): string {
    const name = railroadStyle(chip.railroadId).name
    return chip.isStart ? `Start ${name}` : `Place ${name}`
}
