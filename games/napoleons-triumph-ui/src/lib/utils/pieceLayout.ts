import type { Point } from '@tabletop/common'
import {
    samePosition,
    type Commander,
    type HydratedNapoleonsTriumphGameState,
    type Position,
    type ProjectedUnit
} from '@tabletop/napoleons-triumph'
import { APPROACH_GEOMETRY, LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
import { screenAxes, uprightAngle } from './boardView.js'

export const BLOCK_LENGTH = 104
export const BLOCK_THICKNESS = 20
const BAR_HALF_THICKNESS = 6
const BAR_GAP = 3
const COLUMN_GAP = 6
const GROUP_GAP = 5
const MIN_RANK_SPACING = 7
const FULL_RANK_SPACING = BLOCK_THICKNESS + 2

export interface BlockSprite {
    unit: ProjectedUnit
    centre: Point
    /** Rotation of the block in degrees; 0 lies along the x axis. */
    angle: number
}

/** The pieces a player handles as one: a corps with its commander, or detached units standing together. */
export interface PieceGroup {
    key: string
    playerId: string
    position: Position
    commander?: Commander
    units: ProjectedUnit[]
}

export interface GroupSprite {
    group: PieceGroup
    blocks: BlockSprite[]
    /** Where the commander's flag stands, when the group is a corps. */
    flag?: Point
    /** The middle of the group, for anchoring popups and labels. */
    centre: Point
    /** Half the extent of the group across and along its ranks. */
    radius: number
}

export function groupKey(position: Position, playerId: string, commanderId?: string): string {
    return `${playerId}|${position.locale}:${position.approach ?? 'r'}|${commanderId ?? ''}`
}

/** Groups the pieces on the map by position and corps. */
export function pieceGroups(state: HydratedNapoleonsTriumphGameState): PieceGroup[] {
    const groups = new Map<string, PieceGroup>()
    for (const unit of state.units) {
        const position = unit.position
        if (!position) {
            continue
        }
        const key = groupKey(position, unit.playerId, unit.commanderId)
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
    /** Clockwise turn of the board on screen, so faces and reserve stacks stay level for the viewer. */
    rotation: number
    /** Locales whose pieces are spread out so every block can be told apart and tapped. */
    looseLocales?: readonly number[]
}

function rankSpacing(count: number, room: number, loose: boolean): number {
    if (count <= 1 || loose) {
        return FULL_RANK_SPACING
    }
    const fitted = (room - BLOCK_THICKNESS) / (count - 1)
    return Math.max(MIN_RANK_SPACING, Math.min(FULL_RANK_SPACING, fitted))
}

function sprite(group: PieceGroup, blocks: BlockSprite[], flagAt?: Point): GroupSprite {
    const xs = blocks.map((block) => block.centre.x)
    const ys = blocks.map((block) => block.centre.y)
    const centre = {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2
    }
    const radius =
        Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 +
        BLOCK_LENGTH / 2
    return { group, blocks, flag: group.commander ? flagAt : undefined, centre, radius }
}

/** Pieces blocking an approach line up in ranks behind its bar, two abreast on a wide approach. */
function layoutBlockers(groups: PieceGroup[], approachId: number, options: LayoutOptions): GroupSprite[] {
    const bar = APPROACH_GEOMETRY[approachId]
    const locale = LOCALE_GEOMETRY[groups[0].position.locale]
    const along = { x: Math.cos((bar.angle * Math.PI) / 180), y: Math.sin((bar.angle * Math.PI) / 180) }
    const columns = bar.length > BLOCK_LENGTH * 2 ? 2 : 1
    const total = groups.reduce((sum, group) => sum + group.units.length, 0)
    const ranks = Math.ceil(total / columns)
    const depth = Math.hypot(locale.anchor.x - bar.centre.x, locale.anchor.y - bar.centre.y)
    const loose = options.looseLocales?.includes(groups[0].position.locale) === true
    const spacing = rankSpacing(ranks, Math.max(BLOCK_THICKNESS, depth - BAR_HALF_THICKNESS), loose)
    const angle = uprightAngle(bar.angle, options.rotation)
    const first = BAR_HALF_THICKNESS + BAR_GAP + BLOCK_THICKNESS / 2
    let slot = 0
    let gap = 0
    return groups.map((group, index) => {
        if (index > 0) {
            slot = Math.ceil(slot / columns) * columns
            gap += GROUP_GAP
        }
        const blocks = group.units.map((unit) => {
            const column = slot % columns
            const rank = Math.floor(slot / columns)
            slot += 1
            const sideways = columns === 1 ? 0 : (column - 0.5) * (BLOCK_LENGTH + COLUMN_GAP)
            const inward = first + rank * spacing + gap
            return {
                unit,
                angle,
                centre: {
                    x: bar.centre.x + along.x * sideways + bar.inward.x * inward,
                    y: bar.centre.y + along.y * sideways + bar.inward.y * inward
                }
            }
        })
        return sprite(group, blocks, blocks[0]?.centre)
    })
}

/** Reserve pieces gather round the locale's anchor, each group a short column of blocks level on screen. */
function layoutReserve(groups: PieceGroup[], options: LayoutOptions): GroupSprite[] {
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
        const blocks = group.units.map((unit, rank) => {
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
        return sprite(group, blocks, blocks[0]?.centre)
    })
}

function sortGroups(groups: PieceGroup[]): PieceGroup[] {
    return groups.toSorted((a, b) => {
        if ((a.commander === undefined) !== (b.commander === undefined)) {
            return a.commander ? -1 : 1
        }
        return (a.commander?.id ?? '').localeCompare(b.commander?.id ?? '')
    })
}

/** Where every block on the map is drawn. */
export function layoutPieces(
    state: HydratedNapoleonsTriumphGameState,
    options: LayoutOptions = { rotation: 0 }
): GroupSprite[] {
    const byPosition: PieceGroup[][] = []
    for (const group of pieceGroups(state)) {
        const peers = byPosition.find((entry) => samePosition(entry[0].position, group.position))
        if (peers) {
            peers.push(group)
        } else {
            byPosition.push([group])
        }
    }
    return byPosition.flatMap((groups) => {
        const { approach } = groups[0].position
        const ordered = sortGroups(groups)
        return approach === undefined
            ? layoutReserve(ordered, options)
            : layoutBlockers(ordered, approach, options)
    })
}
