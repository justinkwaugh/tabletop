import { assertExists, distanceAxial, type Point } from '@tabletop/common'
import {
    FIVE_DOLLAR_BONUS,
    MAP_IDS,
    boardMap,
    hexIdToAxial,
    hexOrder,
    isLongDistance,
    railroadsIn,
    cityIn,
    type BoardMap,
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
    closedPath,
    hexCells,
    hexCenter,
    hexOutline,
    insetLoop,
    pointText,
    type BoardGeometry
} from './boardGeometry.js'

/** How far a cell's side stands from its centre, for each unit its corners do. */
const APOTHEM_RATIO = Math.cos(Math.PI / 6)
import { railroadNames, railroadStyle } from './railroadStyle.js'
import { ghostCubes, type GhostCube } from './trackLayout.js'

/** The most rings and marks grow on the board when the view is zoomed out. */
export const LARGEST_PICK_SCALE = 2

/**
 * Rings and marks grow with the board as the view zooms in, and below the fitted desktop scale
 * keep that scale's screen size, up to twice their board size.
 */
export function pickScale(board: BoardGeometry, viewScale: number): number {
    return Math.min(LARGEST_PICK_SCALE, Math.max(1, board.fittedDesktopScale / viewScale))
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
        case 'bonus.au.perth':
        case 'bonus.au.brisbane':
        case 'bonus.ca.toronto':
        case 'bonus.fr.paris':
        case 'bonus.de.berlin':
            return { tone: 'coin', text, spoken: text }
        case 'bonus.usa.five-dollar':
            return { tone: 'five', text, spoken: text }
        case 'bonus.usa.transcontinental':
            return { tone: 'gold', text, spoken: `${text} Transcontinental` }
        case 'bonus.ca.intercolonial':
            return { tone: 'gold', text, spoken: `${text} Intercolonial` }
        case 'bonus.de.greater-germany':
            return { tone: 'gold', text, spoken: `${text} Greater Germany` }
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

/** How many hexes from one hex to another, counted to the other's nearer cell (R-8: Berlin's two). */
export function hexSteps(map: BoardMap, from: HexId, to: HexId): number {
    const start = hexIdToAxial(map.orientation, from)
    return Math.min(...map.cellsOf(to).map((cell) => distanceAxial(start, cell)))
}

/** The centre of the hex's cell nearest the point: its one cell's, or the nearer of Berlin's two. */
function nearestCellCenter(hexId: HexId, point: Point): Point {
    const centers = hexCells(hexId).map((cell) => cell.center)
    const distance = (center: Point) => Math.hypot(point.x - center.x, point.y - center.y)
    return centers.reduce((best, center) => (distance(center) < distance(best) ? center : best))
}

// A plain or mountain from its nearest city, measured to the city's nearer cell; a tie in distance
// goes to the city first in the map's table.
function bearingOf(map: BoardMap, hexId: HexId, terrain: string): Bearing {
    const center = hexCenter(hexId)
    let nearest = map.cities[0]
    let nearestDistance = Infinity
    for (const city of map.cities) {
        const cityCenter = nearestCellCenter(city.hexId, center)
        const distance = Math.hypot(center.x - cityCenter.x, center.y - cityCenter.y)
        if (distance < nearestDistance - DISTANCE_TIE) {
            nearest = city
            nearestDistance = distance
        }
    }
    const cityCenter = nearestCellCenter(nearest.hexId, center)
    return {
        terrain,
        cityName: nearest.name,
        angle: Math.atan2(cityCenter.y - center.y, center.x - cityCenter.x),
        steps: hexSteps(map, hexId, nearest.hexId)
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

// Each hex starts with its coarsest name; hexes of a map that share a name all take the next finer
// one, until no two share.
function namePlaces(map: BoardMap): [HexId, string][] {
    const names = new Map<HexId, string>()
    const bearings = new Map<HexId, Bearing>()
    const fineness = new Map<HexId, number>()
    for (const hex of map.hexes) {
        if (hex.terrain === 'city') {
            names.set(hex.id, map.city(hex.cityId).name)
            continue
        }
        const bearing = bearingOf(map, hex.id, hex.terrain === 'mountain' ? 'Mountain' : 'Plain')
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
    return [...names]
}

// Every map's hexes: hex ids name their map, so no two maps' names meet.
const PLACE_NAMES: ReadonlyMap<HexId, string> = new Map(
    MAP_IDS.flatMap((mapId) => namePlaces(boardMap(mapId)))
)

/**
 * A hex's name on the map: a city by its name; a plain or mountain by the nearest city and the
 * compass point it lies in from it ("Mountain west of Denver"). Where two hexes would share a name,
 * both take a finer compass point, and then their distance in hexes as well ("Plain two hexes west
 * of Rapid City"), so no two hexes share one.
 */
export function placeName(hexId: HexId): string {
    const name = PLACE_NAMES.get(hexId)
    assertExists(name, `Unknown hex ${hexId}`)
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

/**
 * R-8.2: a placement in a long-distance hex, or in Perth or Brisbane, ends the turn. The board says
 * so with the buffer stop alone, so the lit hex's and the popup buttons' names say it in words.
 */
function endsTheTurn(hexId: HexId): string {
    return isLongDistance(hexId) ? ', ends the turn' : ''
}

/**
 * "Chicago: place Orange or Black, $2"; "Dallas: place Yellow or start Black, $5"; "Perth: place
 * Orange, $50, ends the turn".
 */
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
    return `${place}: ${effects}${marks}${endsTheTurn(hex.hexId)}`
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

/**
 * Each of the hex's cells, its corners pulled in towards the cell's centre, for rings drawn inside
 * the hex edge: one polygon a cell.
 */
/**
 * The hex's outline drawn this far in, as SVG points: a cell's own corners brought in towards its
 * centre, or for a hex over two cells (R-8: Berlin) its one outline with every side moved in as
 * far as a cell's sides move, so the hex has one middle and one ring.
 */
export function insetCellPoints(hexId: HexId, inset: number): string[] {
    if (hexCells(hexId).length > 1) {
        return [
            insetLoop(hexOutline(hexId), inset * APOTHEM_RATIO)
                .map(pointText)
                .join(' ')
        ]
    }
    return hexCells(hexId).map(({ center, vertices }) =>
        vertices
            .map((corner) => {
                const dx = corner.x - center.x
                const dy = corner.y - center.y
                const factor = 1 - inset / Math.hypot(dx, dy)
                return pointText({ x: center.x + dx * factor, y: center.y + dy * factor })
            })
            .join(' ')
    )
}

function hexPath(hexId: HexId): string {
    return closedPath(hexOutline(hexId))
}

/**
 * The scrim: the board's land with a hole at each lit hex, filled even-odd; the sea is never
 * dimmed.
 */
export function scrimPath(board: BoardGeometry, holes: readonly HexId[]): string {
    return `${board.landPath}${holes.map(hexPath).join('')}`
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
    /** R-3.2.4, R-8: how far the placement lowers the turn's limit, by the map's mountain cost. */
    limitChange: number
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
        limitChange: chip.limitChange
    }
}

export type ChoiceChip = {
    railroadId: RailroadId
    /** The button's accessible name: the whole choice in words. */
    label: string
    /** A pill only for what the placement earns. */
    pills: ChipPill[]
    /** A mountain mark: the placement lowers the turn's limit by some placements. */
    mountain: boolean
}

/** The railroad popup beside a picked hex: one button per railroad that can act there. */
export type RailroadChoice = {
    hexId: HexId
    /** The popup's accessible name; nothing in it is written out. */
    title: string
    chips: ChoiceChip[]
}

const FEWER_WORDS = ['no', 'one', 'two', 'three'] as const

/**
 * R-3.2.4, R-8: how many fewer placements a change to the turn's limit leaves it, by the map's
 * mountain cost; nothing for a placement that changes it by none (Orange on a German mountain).
 */
export function fewerPlacements(limitChange: number): string | undefined {
    const fewer = -limitChange
    if (!(fewer > 0)) return undefined
    const count = FEWER_WORDS[fewer] ?? String(fewer)
    return `${count} fewer placement${fewer === 1 ? '' : 's'}`
}

function modifierText(modifiers: ChipModifiers): string {
    const pays =
        modifiers.bonuses.length > 0
            ? `, pays ${modifiers.bonuses.map((mark) => mark.spoken).join(' and ')}`
            : modifiers.startUsesBonus !== undefined
              ? `, pays nothing: a start uses up the $${modifiers.startUsesBonus}`
              : ''
    const fewer = fewerPlacements(modifiers.limitChange)
    const mountain = fewer ? `, mountain: ${fewer} this turn` : ''
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
                label: `${chipLabel(chip)}, ${chip.supplyLeft} left${modifierText(modifiers)}${endsTheTurn(popup.hexId)}`,
                pills: chipPills(modifiers),
                mountain: fewerPlacements(modifiers.limitChange) !== undefined
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
