import type { Point } from '@tabletop/common'
import {
    FACTIONS,
    isWinningBase,
    type Faction,
    type HydratedStellarHorizonsGameState
} from '@tabletop/stellar-horizons-2'
import { BOARD_CELL, type SystemFrame } from './boardLayout.js'
import { boxesOverlap, distanceToBox, printedText, type Box } from './tileFeatures.js'

const TAB_HEIGHT = 26
const ROW_GAP = 2
const DIGIT_WIDTH = 13
const TAB_PADDING = 18
const WORLD_CLEARANCE = 58
const MARKER_CLEARANCE = 42
const STAR_CLEARANCE = 34
const MAX_PER_ROW = 3

export interface TabBase {
    playerId: string
    faction: Faction
    settlements: number
    winning: boolean
}

export interface BaseTab {
    base: TabBase
    points: Point[]
    box: Box
    label: Point
}

type Side = 1 | -1

interface Edge {
    side: Side
    top: number
    bottom: number
}

export function systemTabBases(
    state: HydratedStellarHorizonsGameState,
    systemId: string
): TabBase[] {
    const here = state.bases.filter((base) => base.systemId === systemId)
    return FACTIONS.flatMap(({ faction }) =>
        here
            .filter((base) => state.getPlayerState(base.playerId).faction === faction)
            .map((base) => ({
                playerId: base.playerId,
                faction,
                settlements: base.settlements,
                winning: isWinningBase(state, base)
            }))
    )
}

// Bases are tabs attached to one slanted edge of the tile, each cut to the edge's angle and
// reaching the middle of the seam, stacked down that edge. Rows hold more than one tab only
// when one edge is too short, so a system's bases never wrap around a corner.
export function baseTabLayout(frame: SystemFrame, bases: readonly TabBase[]): BaseTab[] {
    if (bases.length === 0) {
        return []
    }
    const halfH = BOARD_CELL.yRadius
    const edges: Edge[] = [
        { side: 1, top: -halfH, bottom: 0 },
        { side: -1, top: -halfH, bottom: 0 },
        { side: 1, top: 0, bottom: halfH },
        { side: -1, top: 0, bottom: halfH }
    ]
    for (const strict of [true, false]) {
        for (let perRow = 1; perRow <= MAX_PER_ROW; perRow++) {
            for (const edge of edges) {
                const tabs = fitOnEdge(frame, bases, edge, perRow, strict)
                if (tabs) {
                    return tabs
                }
            }
        }
    }
    return []
}

function edgeX(y: number, side: Side): number {
    const halfW = BOARD_CELL.xRadius
    return side * (halfW - (Math.abs(y) / BOARD_CELL.yRadius) * (halfW / 2))
}

function tabWidth(base: TabBase): number {
    return TAB_PADDING + String(base.settlements).length * DIGIT_WIDTH
}

function fitOnEdge(
    frame: SystemFrame,
    bases: readonly TabBase[],
    edge: Edge,
    perRow: number,
    strict: boolean
): BaseTab[] | undefined {
    const rows: TabBase[][] = []
    for (let index = 0; index < bases.length; index += perRow) {
        rows.push(bases.slice(index, index + perRow))
    }
    const blockHeight = rows.length * TAB_HEIGHT + (rows.length - 1) * ROW_GAP
    for (let start = edge.top; start + blockHeight <= edge.bottom; start++) {
        const tabs = rows.flatMap((row, rowIndex) =>
            rowTabs(row, start + rowIndex * (TAB_HEIGHT + ROW_GAP), edge.side)
        )
        const clear = tabs.every(
            (tab, index) =>
                isClear(frame, tab.box, strict) &&
                tabs.slice(0, index).every((other) => !boxesOverlap(other.box, tab.box))
        )
        if (clear) {
            return tabs
        }
    }
    return undefined
}

function rowTabs(row: readonly TabBase[], top: number, side: Side): BaseTab[] {
    const bottom = top + TAB_HEIGHT
    const outerTop = edgeX(top, side)
    const outerBottom = edgeX(bottom, side)
    const toward = (a: number, b: number) => (side > 0 ? Math.min(a, b) : Math.max(a, b))
    const away = (a: number, b: number) => (side > 0 ? Math.max(a, b) : Math.min(a, b))
    // Tabs in a row line up on the edge point nearest the centre.
    let inner = toward(outerTop, outerBottom)
    return row.map((base, column) => {
        const near = inner - side * tabWidth(base)
        const far = column === 0 ? away(outerTop, outerBottom) : inner
        const points =
            column === 0
                ? [
                      { x: near, y: top },
                      { x: outerTop, y: top },
                      { x: outerBottom, y: bottom },
                      { x: near, y: bottom }
                  ]
                : [
                      { x: near, y: top },
                      { x: inner, y: top },
                      { x: inner, y: bottom },
                      { x: near, y: bottom }
                  ]
        const tab = {
            base,
            points,
            box: {
                left: Math.min(near, far),
                top,
                right: Math.max(near, far),
                bottom
            },
            label: { x: (near + inner) / 2, y: top + TAB_HEIGHT * 0.7 }
        }
        inner = near - side * ROW_GAP
        return tab
    })
}

function isClear(frame: SystemFrame, box: Box, strict: boolean): boolean {
    if (printedText(frame).some((text) => boxesOverlap(text, box))) {
        return false
    }
    if (!strict) {
        return true
    }
    return (
        frame.slots.every((slot) => distanceToBox(slot, box) >= WORLD_CLEARANCE) &&
        distanceToBox(frame.marker, box) >= MARKER_CLEARANCE &&
        distanceToBox({ x: 0, y: 0 }, box) >= STAR_CLEARANCE
    )
}
