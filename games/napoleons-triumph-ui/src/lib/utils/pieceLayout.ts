import type { Point } from '@tabletop/common'
import {
    samePosition,
    standingGroupKey,
    type Commander,
    type HydratedNapoleonsTriumphGameState,
    type Position,
    type ProjectedUnit
} from '@tabletop/napoleons-triumph'
import {
    APPROACH_GEOMETRY,
    LOCALE_GEOMETRY,
    type ApproachGeometry,
    type LocaleGeometry
} from '$lib/map/boardGeometry.js'
import {
    BLOCK_LENGTH,
    BLOCK_THICKNESS,
    blockCorners,
    coveredBy,
    blockSamples,
    type BlockFootprint
} from './blockShape.js'
import { screenAxes, uprightAngle } from './boardView.js'
import { insidePolygon } from './polygon.js'
import { inReadingOrder } from './unitTypeOrder.js'
import { byCommander } from './groupOrder.js'

export const BAR_HALF_THICKNESS = 6
const BAR_GAP = 3
const COLUMN_GAP = 6
const RESERVE_ROW_GAP = 5
const FILE_GROUP_GAP = 10
const MIN_RANK_SPACING = 7
const INSIDE_STEP = 2
const FAR_SIDE_CLEARANCE = 6
const ROOM_CHOICES = 5
const FULL_RANK_SPACING = BLOCK_THICKNESS + 2
const LEVEL_TOLERANCE = 0.5
const SETTLE_STEP = 12
// Deliberate: files keep the same clear gap from a neighbouring stack as groups in one file keep from
// each other, so two stacks in adjoining locales are not read as one.
const NEIGHBOUR_CLEARANCE = FILE_GROUP_GAP
// Deliberate: a reserve stands as far from the pieces fronting an approach as groups in one file do,
// so the two are never read as one stack.
const RESERVE_CLEARANCE = FILE_GROUP_GAP
const OVERLAP_COST = 12
const STRAY_COST = 3
const DRIFT_COST = 0.02

export interface BlockSprite extends BlockFootprint {
    unit: ProjectedUnit
}

export interface PieceGroup {
    key: string
    playerId: string
    position?: Position
    commander?: Commander
    units: ProjectedUnit[]
}

interface PlacedGroup extends PieceGroup {
    position: Position
    /** Where its singled-out units are shown nearest, when the viewer does not read the stack. */
    singledOutTowards?: Point
}

/**
 * Units an attack or a history picture singles out, the ones to show outermost first, and the place
 * they are shown nearest: the approach they fight at, or where they went.
 */
export interface SingledOut {
    towards?: Point
    unitIds: readonly string[]
}

export interface GroupSprite {
    group: PlacedGroup
    blocks: BlockSprite[]
    /** Its blocks lie closer than a block is thick, so each lies over part of the next. */
    closedUp: boolean
    flagFeetByPreference?: Point[]
    centre: Point
    radius: number
}

export interface HeldApproach {
    approach: number
    playerId: string
}

export function heldApproaches(sprites: readonly GroupSprite[]): HeldApproach[] {
    const holders = new Map<number, string>()
    for (const { group } of sprites) {
        if (group.position.approach !== undefined) {
            holders.set(group.position.approach, group.playerId)
        }
    }
    return [...holders].map(([approach, playerId]) => ({ approach, playerId }))
}

export type BoardPieces = Pick<HydratedNapoleonsTriumphGameState, 'units' | 'commander'>

// Deliberate: where a singled-out unit really stands among the others of its stack is the owner's
// to know. Anyone else sees those units at one end of the stack, whichever of it they are.
function withTheSingledOutForward(
    group: PlacedGroup,
    singledOut: readonly SingledOut[]
): PlacedGroup {
    const here = singledOut.filter(({ unitIds }) =>
        group.units.some((unit) => unitIds.includes(unit.id))
    )
    if (here.length === 0) {
        return group
    }
    const forward = here.flatMap(({ unitIds }) => unitIds)
    const place = (unit: ProjectedUnit) => {
        const at = forward.indexOf(unit.id)
        return at < 0 ? forward.length : at
    }
    return {
        ...group,
        singledOutTowards: here[0].towards,
        units: group.units.toSorted((a, b) => place(a) - place(b))
    }
}

function placedGroups(state: BoardPieces, options: LayoutOptions): PlacedGroup[] {
    const groups = new Map<string, PlacedGroup>()
    for (const unit of state.units) {
        const position = unit.position
        if (!position) {
            continue
        }
        const key = standingGroupKey(unit)
        const group = groups.get(key)
        if (group) {
            group.units.push(unit)
            continue
        }
        const commander = unit.commanderId ? state.commander(unit.commanderId) : undefined
        groups.set(key, { key, playerId: unit.playerId, position, commander, units: [unit] })
    }
    return [...groups.values()].map((group) =>
        group.playerId === options.readBy
            ? { ...group, units: inReadingOrder(group.units) }
            : withTheSingledOutForward(group, options.singledOut ?? [])
    )
}

export interface LayoutOptions {
    rotation: number
    looseLocales?: readonly number[]
    /** The player looking at the board, whose own stacks are put in reading order. */
    readBy?: string
    /** Units that stacks the viewer does not read show at one end, so their place in the stack tells nothing. */
    singledOut?: readonly SingledOut[]
}

function rankSpacing(count: number, room: number, loose: boolean): number {
    if (count <= 1 || loose) {
        return FULL_RANK_SPACING
    }
    const fitted = (room - BLOCK_THICKNESS) / (count - 1)
    return Math.max(MIN_RANK_SPACING, Math.min(FULL_RANK_SPACING, fitted))
}

// A file with groups behind one another gives room to the gaps between them as well as to its ranks.
// Where its blocks lie over one another, each gap also takes the overlap back, so the fit allows for both.
function fileSpacing(ranks: number, gaps: number, room: number, loose: boolean): number {
    const open = rankSpacing(ranks, room - gaps * FILE_GROUP_GAP, loose)
    if (gaps === 0 || open >= BLOCK_THICKNESS) {
        return open
    }
    const closedUp =
        (room - BLOCK_THICKNESS - gaps * (BLOCK_THICKNESS + FILE_GROUP_GAP)) /
        Math.max(1, ranks - 1 - gaps)
    return Math.max(MIN_RANK_SPACING, Math.min(open, closedUp))
}

export function midpoint(points: readonly Point[]): Point {
    return {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length
    }
}

function flagFeetOnTopOfStack(blocks: BlockSprite[], rotation: number): Point[] {
    const { down } = screenAxes(rotation)
    const height = (point: Point) => -(point.x * down.x + point.y * down.y)
    const level = (a: Point, b: Point) => Math.abs(height(a) - height(b)) < LEVEL_TOLERANCE
    const topBlockCorners = blocks
        .map(blockCorners)
        .reduce((highest, corners) =>
            Math.max(...corners.map(height)) > Math.max(...highest.map(height)) ? corners : highest
        )
    const [top, shoulder] = topBlockCorners.toSorted((a, b) => height(b) - height(a))
    return level(top, shoulder) ? [midpoint([top, shoulder]), top, shoulder] : [top, shoulder]
}

function sprite(
    group: PlacedGroup,
    blocks: BlockSprite[],
    spacing: number,
    rotation: number
): GroupSprite {
    const xs = blocks.map((block) => block.centre.x)
    const ys = blocks.map((block) => block.centre.y)
    const centre = {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2
    }
    const radius =
        Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 +
        BLOCK_LENGTH / 2
    const flagFeetByPreference = group.commander
        ? flagFeetOnTopOfStack(blocks, rotation)
        : undefined
    const closedUp = blocks.length > 1 && spacing < BLOCK_THICKNESS
    return { group, blocks, closedUp, flagFeetByPreference, centre, radius }
}

function angleFacingAcross(bar: ApproachGeometry): number {
    return (Math.atan2(-bar.inward.x, bar.inward.y) * 180) / Math.PI
}

interface FiledGroup {
    group: PlacedGroup
    file: number
    ranksAhead: number
    groupsAhead: number
}

function fileGroups(groups: PlacedGroup[], files: number): FiledGroup[] {
    const ranks = Array.from({ length: files }, () => 0)
    const filled = Array.from({ length: files }, () => 0)
    return groups.map((group) => {
        const file = ranks.indexOf(Math.min(...ranks))
        const filed = { group, file, ranksAhead: ranks[file], groupsAhead: filled[file] }
        ranks[file] += group.units.length
        filled[file] += 1
        return filed
    })
}

// Rule 4: a wide approach is as wide as two pieces, so two groups can front it side by side.
function filesAcross(bar: ApproachGeometry): number {
    return bar.length > BLOCK_LENGTH * 2 ? 2 : 1
}

/** How far along its bar, from the middle, the pieces fronting an approach reach. */
export function reachOfFiles(bar: ApproachGeometry): number {
    return filesAcross(bar) === 1 ? BLOCK_LENGTH / 2 : BLOCK_LENGTH + COLUMN_GAP / 2
}

/**
 * A file the viewer reads runs Guard to artillery from the top of the screen down where it stands
 * more upright than level on screen, and from inside its locale out to the bar where it lies level.
 */
function ranksFromTheBar(
    group: PlacedGroup,
    bar: ApproachGeometry,
    options: LayoutOptions
): ProjectedUnit[] {
    if (group.playerId !== options.readBy) {
        return group.units
    }
    const { right, down } = screenAxes(options.rotation)
    const intoTheLocale = {
        across: bar.inward.x * right.x + bar.inward.y * right.y,
        down: bar.inward.x * down.x + bar.inward.y * down.y
    }
    const upright = Math.abs(intoTheLocale.down) >= Math.abs(intoTheLocale.across)
    const barIsTheTop = upright && intoTheLocale.down > 0
    return barIsTheTop ? group.units : group.units.toReversed()
}

const roomInsideByApproach = new Map<number, number>()

function filesStayInside(bar: ApproachGeometry, outline: readonly Point[], inward: number) {
    const radians = (bar.angle * Math.PI) / 180
    const reach = reachOfFiles(bar)
    return [-reach, 0, reach].every((sideways) =>
        insidePolygon(
            {
                x: bar.centre.x + Math.cos(radians) * sideways + bar.inward.x * inward,
                y: bar.centre.y + Math.sin(radians) * sideways + bar.inward.y * inward
            },
            outline
        )
    )
}

// How deep the files fronting an approach can stand before a block of them would leave the locale.
function roomInsideLocale(approachId: number, locale: LocaleGeometry): number {
    const known = roomInsideByApproach.get(approachId)
    if (known !== undefined) {
        return known
    }
    const bar = APPROACH_GEOMETRY[approachId]
    const nearest = BAR_HALF_THICKNESS + BAR_GAP
    let inward = nearest
    while (filesStayInside(bar, locale.outline, inward + INSIDE_STEP)) {
        inward += INSIDE_STEP
    }
    const room = inward - nearest - FAR_SIDE_CLEARANCE
    roomInsideByApproach.set(approachId, room)
    return room
}

// Deliberate: files stop at the locale's anchor, leaving its middle to whatever else stands there.
// With the locale to themselves they may take its whole depth before they close up, and are
// offered the depths between so they can stop short of a neighbouring stack.
function roomsToTry(approachId: number, locale: LocaleGeometry, aloneInLocale: boolean): number[] {
    const bar = APPROACH_GEOMETRY[approachId]
    const depth = Math.hypot(locale.anchor.x - bar.centre.x, locale.anchor.y - bar.centre.y)
    const toAnchor = Math.max(BLOCK_THICKNESS, depth - BAR_HALF_THICKNESS)
    const inside = aloneInLocale ? roomInsideLocale(approachId, locale) : toAnchor
    if (inside <= toAnchor) {
        return [toAnchor]
    }
    return Array.from(
        { length: ROOM_CHOICES },
        (_, choice) => inside - ((inside - toAnchor) * choice) / (ROOM_CHOICES - 1)
    )
}

function layoutBlockers(
    groups: PlacedGroup[],
    approachId: number,
    options: LayoutOptions,
    firstFile: number,
    room: number
): GroupSprite[] {
    const bar = APPROACH_GEOMETRY[approachId]
    const along = {
        x: Math.cos((bar.angle * Math.PI) / 180),
        y: Math.sin((bar.angle * Math.PI) / 180)
    }
    const files = filesAcross(bar)
    const filed = fileGroups(groups, files)
    const deepest = Math.max(
        ...filed.map(({ group, ranksAhead }) => ranksAhead + group.units.length)
    )
    const loose = options.looseLocales?.includes(groups[0].position.locale) === true
    const gapsInAFile = Math.max(...filed.map(({ groupsAhead }) => groupsAhead))
    const spacing = fileSpacing(deepest, gapsInAFile, room, loose)
    // Deliberate: groups filed one behind another stand a clear gap apart even where their own
    // blocks lie over one another, so a detached unit behind a corps is not read as part of it.
    const betweenGroups = Math.max(0, BLOCK_THICKNESS - spacing) + FILE_GROUP_GAP
    const angle = angleFacingAcross(bar)
    const first = BAR_HALF_THICKNESS + BAR_GAP + BLOCK_THICKNESS / 2
    const frontToRear = filed.map(({ group, file, ranksAhead, groupsAhead }) => {
        const sideways =
            files === 1 ? 0 : (((file + firstFile) % files) - 0.5) * (BLOCK_LENGTH + COLUMN_GAP)
        const fromTheBar = ranksFromTheBar(group, bar, options).map((unit, place) => {
            const inward = first + (ranksAhead + place) * spacing + groupsAhead * betweenGroups
            return {
                unit,
                angle,
                centre: {
                    x: bar.centre.x + along.x * sideways + bar.inward.x * inward,
                    y: bar.centre.y + along.y * sideways + bar.inward.y * inward
                }
            }
        })
        return sprite(group, fromTheBar.toReversed(), spacing, options.rotation)
    })
    return frontToRear.toReversed()
}

function choicesOfFile(approachId: number): number {
    return filesAcross(APPROACH_GEOMETRY[approachId])
}

function covering(blocks: readonly BlockFootprint[], placed: readonly BlockFootprint[]): number {
    return blocks.flatMap(blockSamples).filter(coveredBy(placed, NEIGHBOUR_CLEARANCE)).length
}

function clearestFiles(
    groups: PlacedGroup[],
    approachId: number,
    options: LayoutOptions,
    placed: readonly BlockFootprint[],
    aloneInLocale: boolean
): GroupSprite[] {
    const locale = LOCALE_GEOMETRY[groups[0].position.locale]
    const arrangements = roomsToTry(approachId, locale, aloneInLocale).flatMap((room) =>
        Array.from({ length: choicesOfFile(approachId) }, (_, firstFile) =>
            layoutBlockers(groups, approachId, options, firstFile, room)
        )
    )
    const overlap = (sprites: GroupSprite[]) =>
        covering(
            sprites.flatMap((sprite) => sprite.blocks),
            placed
        )
    return arrangements.reduce((clearest, arrangement) =>
        overlap(arrangement) < overlap(clearest) ? arrangement : clearest
    )
}

interface PlacedBlocks {
    group: PlacedGroup
    blocks: BlockSprite[]
    spacing: number
}

function isBelow(place: Point, locale: LocaleGeometry, down: Point): boolean {
    return (place.x - locale.anchor.x) * down.x + (place.y - locale.anchor.y) * down.y > 0
}

function arrangeReserve(groups: PlacedGroup[], options: LayoutOptions): PlacedBlocks[] {
    const locale = LOCALE_GEOMETRY[groups[0].position.locale]
    const { right, down } = screenAxes(options.rotation)
    const angle = uprightAngle((Math.atan2(right.y, right.x) * 180) / Math.PI, options.rotation)
    const loose = options.looseLocales?.includes(groups[0].position.locale) === true
    const room = Math.max(BLOCK_THICKNESS * 2, locale.clearance * 2.2)
    const columns = Math.max(
        1,
        Math.min(groups.length, Math.floor((locale.clearance * 2.6) / (BLOCK_LENGTH + COLUMN_GAP)))
    )
    const rows = Math.ceil(groups.length / columns)
    const tallest = Math.max(...groups.map((group) => group.units.length))
    const spacing = rankSpacing(tallest * rows, room, loose)
    const rowHeight = BLOCK_THICKNESS + (tallest - 1) * spacing + RESERVE_ROW_GAP * 2
    return groups.map((group, index) => {
        const column = index % columns
        const row = Math.floor(index / columns)
        const inRow = Math.min(columns, groups.length - row * columns)
        const across = (column - (inRow - 1) / 2) * (BLOCK_LENGTH + COLUMN_GAP)
        const top =
            -(rows * rowHeight) / 2 +
            row * rowHeight +
            RESERVE_ROW_GAP +
            BLOCK_THICKNESS / 2 +
            ((tallest - group.units.length) * spacing) / 2
        const singledOutAtTheBottom =
            group.singledOutTowards !== undefined && isBelow(group.singledOutTowards, locale, down)
        const fromTheTop = singledOutAtTheBottom ? group.units.toReversed() : group.units
        const topToBottom = fromTheTop.map((unit, rank) => {
            const along = top + rank * spacing
            return {
                unit,
                angle,
                centre: {
                    x: locale.anchor.x + right.x * across + down.x * along,
                    y: locale.anchor.y + right.y * across + down.y * along
                }
            }
        })
        return { group, blocks: topToBottom.toReversed(), spacing }
    })
}

function moved(point: Point, shift: Point): Point {
    return { x: point.x + shift.x, y: point.y + shift.y }
}

function shiftClearOf(
    reserve: readonly PlacedBlocks[],
    locale: LocaleGeometry,
    placed: readonly BlockFootprint[]
): Point {
    const samples = reserve.flatMap(({ blocks }) => blocks.flatMap(blockSamples))
    const reach = Math.max(
        ...[...locale.outline, ...samples].map((point) =>
            Math.hypot(point.x - locale.anchor.x, point.y - locale.anchor.y)
        )
    )
    const near = placed.filter(
        (block) =>
            Math.hypot(block.centre.x - locale.anchor.x, block.centre.y - locale.anchor.y) <
            reach * 2 + BLOCK_LENGTH
    )
    const onPlaced = coveredBy(near, RESERVE_CLEARANCE)
    const covered = (shift: Point) =>
        samples.filter((sample) => onPlaced(moved(sample, shift))).length
    const stay = { x: 0, y: 0 }
    if (covered(stay) === 0) {
        return stay
    }
    const cost = (shift: Point) =>
        covered(shift) * OVERLAP_COST +
        samples.filter((sample) => !insidePolygon(moved(sample, shift), locale.outline)).length *
            STRAY_COST +
        Math.hypot(shift.x, shift.y) * DRIFT_COST
    const xs = locale.outline.map((corner) => corner.x)
    const ys = locale.outline.map((corner) => corner.y)
    let best = stay
    let lowest = cost(stay)
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += SETTLE_STEP) {
        for (let y = Math.min(...ys); y <= Math.max(...ys); y += SETTLE_STEP) {
            if (!insidePolygon({ x, y }, locale.outline)) {
                continue
            }
            const shift = { x: x - locale.anchor.x, y: y - locale.anchor.y }
            const candidate = cost(shift)
            if (candidate < lowest) {
                best = shift
                lowest = candidate
            }
        }
    }
    return best
}

function sortGroups(groups: PlacedGroup[]): PlacedGroup[] {
    return groups.toSorted((a, b) => byCommander(a.commander?.id, b.commander?.id))
}

export function layoutPieces(
    state: BoardPieces,
    options: LayoutOptions = { rotation: 0 }
): GroupSprite[] {
    const byPosition: PlacedGroup[][] = []
    for (const group of placedGroups(state, options)) {
        const peers = byPosition.find((entry) => samePosition(entry[0].position, group.position))
        if (peers) {
            peers.push(group)
        } else {
            byPosition.push([group])
        }
    }
    const placed: BlockFootprint[] = []
    const blocking = byPosition
        .flatMap((groups) => {
            const { approach } = groups[0].position
            return approach === undefined ? [] : [{ groups: sortGroups(groups), approach }]
        })
        .toSorted((a, b) => choicesOfFile(a.approach) - choicesOfFile(b.approach))
        .flatMap(({ groups, approach }) => {
            const { locale } = groups[0].position
            const standingInLocale = byPosition.filter(
                (entry) => entry[0].position.locale === locale
            )
            const sprites = clearestFiles(
                groups,
                approach,
                options,
                placed,
                standingInLocale.length === 1
            )
            placed.push(...sprites.flatMap((sprite) => sprite.blocks))
            return sprites
        })
    const inReserve = byPosition
        .filter((groups) => groups[0].position.approach === undefined)
        .flatMap((groups) => {
            const reserve = arrangeReserve(sortGroups(groups), options)
            const locale = LOCALE_GEOMETRY[groups[0].position.locale]
            const shift = shiftClearOf(reserve, locale, placed)
            const settled = reserve.map(({ group, blocks, spacing }) =>
                sprite(
                    group,
                    blocks.map((block) => ({ ...block, centre: moved(block.centre, shift) })),
                    spacing,
                    options.rotation
                )
            )
            placed.push(...settled.flatMap((sprite) => sprite.blocks))
            return settled
        })
    return [...blocking, ...inReserve]
}
