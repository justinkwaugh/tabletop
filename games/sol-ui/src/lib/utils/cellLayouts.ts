import type { Point } from '@tabletop/common'
import { CELL_LAYOUT_5P } from './cellLayout5p.js'
import { CELL_LAYOUT_4P } from './cellLayout4p.js'
import { Direction, HydratedSolGameBoard, Ring, StationType, type Cell } from '@tabletop/sol'
import {
    addToAngle,
    getCirclePoint,
    getSpaceCentroid,
    getSpaceCentroidAngleAndRadius,
    subtractFromAngle,
    toRadians
} from './boardGeometry.js'

export type CellLayouts = Record<string, CellLayoutRecord>
export type CellLayoutRecord = Record<string, CellLayout>
export type CellLayout = {
    station?: { point: Point; z: number }
    divers: Point[]
}

const TWO_DIVER_PLUS_STATION_ANGLE_OFFSETS_PER_RING = [0, 16, 12, 8.5, 8, 8]
const TWO_DIVER_ANGLE_OFFSETS_PER_RING = [0, 12, 6, 4, 4, 4]

export function getCellLayout(
    cell: Cell,
    playerCount: number,
    board: HydratedSolGameBoard
): CellLayout {
    const numPlayersWithDivers = board.playersWithSundivers(cell).length

    if (cell.station && cell.station.type !== StationType.TransmitTower) {
        if (numPlayersWithDivers < 3) {
            const center = getSpaceCentroidAngleAndRadius(playerCount, cell.coords)
            const gates = board.gatesForCell(cell.coords, Direction.In)
            const radiusOffset = gates.length > 0 && cell.coords.row < Ring.Inner ? 12 : 0
            const stationPoint = getCirclePoint(
                center.radius + radiusOffset,
                toRadians(center.angle)
            )
            const diver1 = getCirclePoint(
                center.radius + 10,
                toRadians(
                    subtractFromAngle(
                        center.angle,
                        TWO_DIVER_PLUS_STATION_ANGLE_OFFSETS_PER_RING[cell.coords.row]
                    )
                )
            )
            const diver2 = getCirclePoint(
                center.radius + 10,
                toRadians(
                    addToAngle(
                        center.angle,
                        TWO_DIVER_PLUS_STATION_ANGLE_OFFSETS_PER_RING[cell.coords.row]
                    )
                )
            )
            return {
                station: { point: stationPoint, z: 1 },
                divers: [diver1, diver2]
            }
        }
    } else if (!cell.station) {
        if (numPlayersWithDivers === 1) {
            const center = getSpaceCentroidAngleAndRadius(playerCount, cell.coords)
            const diver1 = getCirclePoint(center.radius + 10, toRadians(center.angle))
            return {
                station: undefined,
                divers: [diver1]
            }
        } else if (numPlayersWithDivers === 2) {
            // Just split the divers
            const center = getSpaceCentroidAngleAndRadius(playerCount, cell.coords)
            const diver1 = getCirclePoint(
                center.radius + 10,
                toRadians(
                    subtractFromAngle(
                        center.angle,
                        TWO_DIVER_ANGLE_OFFSETS_PER_RING[cell.coords.row]
                    )
                )
            )
            const diver2 = getCirclePoint(
                center.radius + 10,
                toRadians(
                    addToAngle(center.angle, TWO_DIVER_ANGLE_OFFSETS_PER_RING[cell.coords.row])
                )
            )
            return {
                station: undefined,
                divers: [diver1, diver2]
            }
        } else if (numPlayersWithDivers === 3) {
            if (cell.coords.row === Ring.Core) {
                // Triangle shape
                const center = getSpaceCentroidAngleAndRadius(playerCount, cell.coords)
                const diver1 = getCirclePoint(center.radius - 20, toRadians(center.angle))
                const diver2 = getCirclePoint(
                    center.radius + 15,
                    toRadians(addToAngle(center.angle, 14))
                )
                const diver3 = getCirclePoint(
                    center.radius + 15,
                    toRadians(subtractFromAngle(center.angle, 14))
                )
                return {
                    station: undefined,
                    divers: [diver1, diver2, diver3]
                }
            }
        } else if (numPlayersWithDivers === 4) {
            if (cell.coords.row === Ring.Core) {
                // Triangle shape
                const center = getSpaceCentroidAngleAndRadius(playerCount, cell.coords)
                const diver1 = getCirclePoint(
                    center.radius - 20,
                    toRadians(subtractFromAngle(center.angle, 14))
                )
                const diver2 = getCirclePoint(
                    center.radius + 20,
                    toRadians(addToAngle(center.angle, 6))
                )
                const diver3 = getCirclePoint(
                    center.radius + 20,
                    toRadians(subtractFromAngle(center.angle, 18))
                )
                const diver4 = getCirclePoint(
                    center.radius - 20,
                    toRadians(addToAngle(center.angle, 18))
                )
                return {
                    station: undefined,
                    divers: [diver1, diver2, diver3, diver4]
                }
            }
        }
    }

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
