import type { Point } from '@tabletop/common'
import { CELL_LAYOUT_5P } from './cellLayout5p.js'
import { CELL_LAYOUT_4P } from './cellLayout4p.js'
import { Direction, HydratedSolGameBoard, StationType, type Cell } from '@tabletop/sol'

export type CellLayouts = Record<string, CellLayoutRecord>
export type CellLayoutRecord = Record<string, CellLayout>
export type CellLayout = {
    station?: { point: Point; z: number }
    divers: Point[]
}

export function getCellLayout(
    cell: Cell,
    playerCount: number,
    board: HydratedSolGameBoard
): CellLayout {
    const layouts = cellLayoutsForPlayerCount(playerCount)
    const layoutCellKey = `${cell.coords.row}-${cell.coords.col}`
    const layoutRecords = layouts[layoutCellKey]

    for (const key of layoutKeyHeirarchyForCell(cell, board)) {
        if (layoutRecords[key]) {
            return layoutRecords[key]
        }
    }

    return {
        station: undefined,
        divers: []
    }
}

function cellLayoutsForPlayerCount(playerCount: number): CellLayouts {
    return playerCount === 5 ? CELL_LAYOUT_5P : CELL_LAYOUT_4P
}

function layoutKeyHeirarchyForCell(cell: Cell, board: HydratedSolGameBoard): string[] {
    const keys: string[] = []

    let prefix = 'd'
    if (cell.station) {
        prefix = cell.station.type === StationType.TransmitTower ? 't' : 's'
    }

    let layoutKey = prefix
    const gates = board.gatesForCell(cell.coords, Direction.In)
    if (gates.length >= 1 && gates[0]) {
        layoutKey += '-g1'
    }
    if (gates.length >= 2 && gates[1]) {
        layoutKey += '-g2'
    }
    keys.push(layoutKey)
    keys.push(`${prefix}-g1`)
    keys.push(`${prefix}-g1-g2`)
    if (prefix !== 't') {
        keys.push('t')
        keys.push('t-g1')
        keys.push('t-g1-g2')
    }
    return keys
}
