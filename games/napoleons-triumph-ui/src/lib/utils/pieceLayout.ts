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

export const BAR_HALF_THICKNESS = 6
const BAR_GAP = 3
const COLUMN_GAP = 6
const GROUP_GAP = 5
const MIN_RANK_SPACING = 7
const FULL_RANK_SPACING = BLOCK_THICKNESS + 2
const LEVEL_TOLERANCE = 0.5
const SETTLE_STEP = 12
const SETTLE_CLEARANCE = 3
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

function placedGroups(state: BoardPieces): PlacedGroup[] {
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
    return [...groups.values()]
}

export interface LayoutOptions {
    rotation: number
    looseLocales?: readonly number[]
}

function rankSpacing(count: number, room: number, loose: boolean): number {
    if (count <= 1 || loose) {
        return FULL_RANK_SPACING
    }
    const fitted = (room - BLOCK_THICKNESS) / (count - 1)
    return Math.max(MIN_RANK_SPACING, Math.min(FULL_RANK_SPACING, fitted))
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

function layoutBlockers(
    groups: PlacedGroup[],
    approachId: number,
    options: LayoutOptions,
    firstFile: number
): GroupSprite[] {
    const bar = APPROACH_GEOMETRY[approachId]
    const locale = LOCALE_GEOMETRY[groups[0].position.locale]
    const along = {
        x: Math.cos((bar.angle * Math.PI) / 180),
        y: Math.sin((bar.angle * Math.PI) / 180)
    }
    const files = filesAcross(bar)
    const filed = fileGroups(groups, files)
    const deepest = Math.max(
        ...filed.map(({ group, ranksAhead }) => ranksAhead + group.units.length)
    )
    const depth = Math.hypot(locale.anchor.x - bar.centre.x, locale.anchor.y - bar.centre.y)
    const loose = options.looseLocales?.includes(groups[0].position.locale) === true
    const spacing = rankSpacing(
        deepest,
        Math.max(BLOCK_THICKNESS, depth - BAR_HALF_THICKNESS),
        loose
    )
    const angle = angleFacingAcross(bar)
    const first = BAR_HALF_THICKNESS + BAR_GAP + BLOCK_THICKNESS / 2
    const frontToRear = filed.map(({ group, file, ranksAhead, groupsAhead }) => {
        const sideways =
            files === 1 ? 0 : (((file + firstFile) % files) - 0.5) * (BLOCK_LENGTH + COLUMN_GAP)
        const fromTheBar = group.units.map((unit, place) => {
            const inward = first + (ranksAhead + place) * spacing + groupsAhead * GROUP_GAP
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
    return blocks.flatMap(blockSamples).filter(coveredBy(placed, SETTLE_CLEARANCE)).length
}

function clearestFiles(
    groups: PlacedGroup[],
    approachId: number,
    options: LayoutOptions,
    placed: readonly BlockFootprint[]
): GroupSprite[] {
    const arrangements = Array.from({ length: choicesOfFile(approachId) }, (_, firstFile) =>
        layoutBlockers(groups, approachId, options, firstFile)
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
    const rowHeight = BLOCK_THICKNESS + (tallest - 1) * spacing + GROUP_GAP * 2
    return groups.map((group, index) => {
        const column = index % columns
        const row = Math.floor(index / columns)
        const inRow = Math.min(columns, groups.length - row * columns)
        const across = (column - (inRow - 1) / 2) * (BLOCK_LENGTH + COLUMN_GAP)
        const top =
            -(rows * rowHeight) / 2 +
            row * rowHeight +
            GROUP_GAP +
            BLOCK_THICKNESS / 2 +
            ((tallest - group.units.length) * spacing) / 2
        const topToBottom = group.units.map((unit, rank) => {
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
    const onPlaced = coveredBy(near, SETTLE_CLEARANCE)
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
    return groups.toSorted((a, b) => {
        if ((a.commander === undefined) !== (b.commander === undefined)) {
            return a.commander ? -1 : 1
        }
        return (a.commander?.id ?? '').localeCompare(b.commander?.id ?? '')
    })
}

export function layoutPieces(
    state: BoardPieces,
    options: LayoutOptions = { rotation: 0 }
): GroupSprite[] {
    const byPosition: PlacedGroup[][] = []
    for (const group of placedGroups(state)) {
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
            const sprites = clearestFiles(groups, approach, options, placed)
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
