import type { Point, PolarCoordinates } from '@tabletop/common'
import { CELL_LAYOUT_5P } from './cellLayout5p.js'
import { CELL_LAYOUT_4P } from './cellLayout4p.js'
import { Direction, HydratedSolGameBoard, Ring, StationType, type Cell } from '@tabletop/sol'
import {
    addToAngle,
    getCirclePoint,
    getSpaceCentroidPolarCoordinates,
    subtractFromAngle,
    toRadians
} from './boardGeometry.js'

export type CellLayouts = Record<string, CellLayoutRecord>
export type CellLayoutRecord = Record<string, CellLayout>
export type CellLayout = {
    station?: { point: Point; z: number }
    divers: Point[]
}

const TWO_DIVER_PLUS_STATION_ANGLE_OFFSETS_PER_RING = [0, 16, 13, 9, 8, 8]
const TWO_DIVER_PLUS_STATION_RADIUS_OFFSETS_PER_RING = [0, 9, 9, 9, -10, 20]

const TWO_DIVER_ANGLE_OFFSETS_PER_RING = [0, 12, 6, 4.2, 2.6, 2.5]
const TWO_DIVER_RADIUS_OFFSETS_PER_RING = [0, 10, 10, 10, 3, 12]

export function getCellLayout(
    cell: Cell,
    playerCount: number,
    board: HydratedSolGameBoard
): CellLayout {
    if (cell.coords.row === Ring.Center) {
        return {
            station: undefined,
            divers: []
        }
    }

    const numPlayersWithDivers = board.playersWithSundivers(cell).length
    const center = getSpaceCentroidPolarCoordinates(playerCount, cell.coords)

    let layout = undefined
    if (cell.station && cell.station.type !== StationType.TransmitTower) {
        if (numPlayersWithDivers < 3) {
            if (cell.coords.row === Ring.Core) {
                layout = nonTowerTwoOrLessDiverCore(cell, center)
            } else {
                layout = nonTowerTwoOrLessDiverNonCore(cell, center, board)
            }
        } else if (numPlayersWithDivers === 3) {
            if (cell.coords.row === Ring.Core) {
                layout = nonTowerThreeDiverCore(cell, center)
            } else if (cell.coords.row === Ring.Radiative) {
                layout = nonTowerThreeDiverRadiative(cell, center, board)
            } else if (cell.coords.row === Ring.Convective) {
                layout = nonTowerThreeDiverConvective(cell, center, board)
            } else if (cell.coords.row === Ring.Inner) {
                layout = nonTowerThreeDiverInner(cell, center, board)
            } else if (cell.coords.row === Ring.Outer) {
                layout = nonTowerThreeDiverOuter(cell, center)
            }
        } else if (numPlayersWithDivers === 4) {
            if (cell.coords.row === Ring.Core) {
                layout = nonTowerFourDiverCore(cell, center)
            } else if (cell.coords.row === Ring.Radiative) {
                layout = nonTowerFourDiverRadiative(cell, center, board)
            } else if (cell.coords.row === Ring.Convective) {
                layout = nonTowerFourDiverConvective(cell, center, board)
            } else if (cell.coords.row === Ring.Inner) {
                layout = nonTowerFourDiverInner(cell, center, board)
            } else if (cell.coords.row === Ring.Outer) {
                layout = nonTowerFourDiverOuter(cell, center)
            }
        }
    } else if (!cell.station) {
        if (numPlayersWithDivers === 1) {
            layout = noStationOneDiver(cell, center)
        } else if (numPlayersWithDivers === 2) {
            layout = noStationTwoDivers(cell, center)
        } else if (numPlayersWithDivers === 3) {
            if (cell.coords.row === Ring.Core) {
                layout = noStationThreeDiversCore(cell, center)
            } else if (cell.coords.row === Ring.Radiative) {
                layout = noStationThreeDiversRadiative(cell, center, board)
            } else if (cell.coords.row === Ring.Convective) {
                layout = noStationThreeDiversConvective(cell, center, board)
            } else if (cell.coords.row === Ring.Inner) {
                layout = noStationThreeDiversInner(cell, center)
            } else if (cell.coords.row === Ring.Outer) {
                layout = noStationThreeDiversOuter(cell, center)
            }
        } else if (numPlayersWithDivers === 4) {
            if (cell.coords.row === Ring.Core) {
                layout = noStationFourDiversCore(cell, center)
            } else if (cell.coords.row === Ring.Radiative) {
                layout = noStationFourDiversRadiative(cell, center, board)
            } else if (cell.coords.row === Ring.Convective) {
                layout = noStationFourDiversConvective(cell, center, board)
            } else if (cell.coords.row === Ring.Inner) {
                layout = noStationFourDiversInner(cell, center, board)
            } else if (cell.coords.row === Ring.Outer) {
                layout = noStationFourDiversOuter(cell, center)
            }
        } else if (numPlayersWithDivers === 5) {
            if (cell.coords.row === Ring.Core) {
                layout = noStationFiveDiversCore(cell, center)
            } else if (cell.coords.row === Ring.Radiative) {
                layout = noStationFiveDiversRadiative(cell, center, board)
            } else if (cell.coords.row === Ring.Convective) {
                layout = noStationFiveDiversConvective(cell, center, board)
            } else if (cell.coords.row === Ring.Inner) {
                layout = noStationFiveDiversInner(cell, center, board)
            } else if (cell.coords.row === Ring.Outer) {
                layout = noStationFiveDiversOuter(cell, center)
            }
        }
    }

    if (!layout) {
        const layouts = cellLayoutsForPlayerCount(playerCount)
        const layoutCellKey = `${cell.coords.row}-${cell.coords.col}`
        const layoutRecords = layouts[layoutCellKey]

        for (const key of layoutKeyHeirarchyForCell(cell, board)) {
            if (layoutRecords[key]) {
                layout = layoutRecords[key]
            }
        }
    }

    return (
        layout ?? {
            station: undefined,
            divers: []
        }
    )
}

function centerOffset(center: PolarCoordinates, radius: number, angleDegrees: number): Point {
    const offsetRadius = center.radius + radius
    const offsetAngle =
        angleDegrees >= 0
            ? addToAngle(center.angle, angleDegrees)
            : subtractFromAngle(center.angle, -angleDegrees)
    return getCirclePoint(offsetRadius, toRadians(offsetAngle))
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

function noStationOneDiver(cell: Cell, center: PolarCoordinates): CellLayout {
    const diver1 = centerOffset(center, 10, 0)
    return {
        station: undefined,
        divers: [diver1]
    }
}

function noStationTwoDivers(cell: Cell, center: PolarCoordinates): CellLayout {
    const radiusOffset = TWO_DIVER_RADIUS_OFFSETS_PER_RING[cell.coords.row]
    const angleOffset = TWO_DIVER_ANGLE_OFFSETS_PER_RING[cell.coords.row]

    const diver1 = centerOffset(
        center,
        radiusOffset,
        -angleOffset + (cell.coords.row === Ring.Inner ? 1 : 0)
    )
    const diver2 = centerOffset(
        center,
        radiusOffset,
        angleOffset + (cell.coords.row === Ring.Inner ? 1.75 : 0)
    )
    return {
        station: undefined,
        divers: [diver1, diver2]
    }
}

function noStationThreeDiversCore(cell: Cell, center: PolarCoordinates): CellLayout {
    const diver1 = centerOffset(center, -20, 0)
    const diver2 = centerOffset(center, 20, 14)
    const diver3 = centerOffset(center, 15, -14)
    return {
        station: undefined,
        divers: [diver1, diver2, diver3]
    }
}

function noStationThreeDiversRadiative(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout | undefined {
    const numInwardNeighbors = board.neighborsAt(cell.coords, Direction.In).length
    if (numInwardNeighbors == 1) {
        const diver1 = centerOffset(center, -10, -14)
        const diver2 = centerOffset(center, -10, 14)
        const diver3 = centerOffset(center, 15, 0)
        return {
            station: undefined,
            divers: [diver1, diver2, diver3]
        }
    } else {
        const diver1 = centerOffset(center, 15, -14)
        const diver2 = centerOffset(center, 15, 14)
        const diver3 = centerOffset(center, 5, 0)
        return {
            station: undefined,
            divers: [diver1, diver2, diver3]
        }
    }
}

function noStationThreeDiversConvective(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout {
    const numInwardNeighbors = board.neighborsAt(cell.coords, Direction.In).length
    if (numInwardNeighbors == 1) {
        const diver1 = centerOffset(center, -10, -8)
        const diver2 = centerOffset(center, -10, 8)
        const diver3 = centerOffset(center, 15, 0)
        return {
            station: undefined,
            divers: [diver1, diver2, diver3]
        }
    } else {
        const diver1 = centerOffset(center, 15, -8)
        const diver2 = centerOffset(center, 15, 8)
        const diver3 = centerOffset(center, 5, 0)
        return {
            station: undefined,
            divers: [diver1, diver2, diver3]
        }
    }
}

function noStationThreeDiversInner(cell: Cell, center: PolarCoordinates): CellLayout {
    const diver1 = centerOffset(center, 17, -1)
    const diver2 = centerOffset(center, 15, 6)
    const diver3 = centerOffset(center, -25, 1)
    return {
        station: undefined,
        divers: [diver1, diver2, diver3]
    }
}

function noStationThreeDiversOuter(cell: Cell, center: PolarCoordinates): CellLayout {
    const diver1 = centerOffset(center, 15, -7)
    const diver2 = centerOffset(center, 0, 0)
    const diver3 = centerOffset(center, 15, 7)
    return {
        station: undefined,
        divers: [diver1, diver2, diver3]
    }
}

function noStationFourDiversCore(cell: Cell, center: PolarCoordinates): CellLayout {
    const diver1 = centerOffset(center, -20, -15)
    const diver2 = centerOffset(center, 20, 6)
    const diver3 = centerOffset(center, 24, -18)
    const diver4 = centerOffset(center, -20, 18)
    return {
        station: undefined,
        divers: [diver1, diver2, diver3, diver4]
    }
}

function noStationFourDiversRadiative(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout | undefined {
    const numInwardNeighbors = board.neighborsAt(cell.coords, Direction.In).length
    if (numInwardNeighbors == 1) {
        const diver1 = centerOffset(center, -10, -14)
        const diver2 = centerOffset(center, 25, 6)
        const diver3 = centerOffset(center, 20, -6)
        const diver4 = centerOffset(center, -10, 14)
        return {
            station: undefined,
            divers: [diver1, diver2, diver3, diver4]
        }
    } else {
        const diver1 = centerOffset(center, 22, -14)
        const diver2 = centerOffset(center, 22, 5)
        const diver3 = centerOffset(center, 0, -5)
        const diver4 = centerOffset(center, 0, 15)

        return {
            station: undefined,
            divers: [diver1, diver2, diver3, diver4]
        }
    }
}

function noStationFourDiversConvective(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout | undefined {
    const numInwardNeighbors = board.neighborsAt(cell.coords, Direction.In).length
    if (numInwardNeighbors == 1) {
        const diver1 = centerOffset(center, -10, -9)
        const diver2 = centerOffset(center, 20, 3.5)
        const diver3 = centerOffset(center, 20, -3.5)
        const diver4 = centerOffset(center, -10, 9)
        return {
            station: undefined,
            divers: [diver1, diver2, diver3, diver4]
        }
    } else {
        const diver1 = centerOffset(center, 26, -10)
        const diver2 = centerOffset(center, 26, 3)
        const diver3 = centerOffset(center, 4, -3)
        const diver4 = centerOffset(center, 4, 9)

        return {
            station: undefined,
            divers: [diver1, diver2, diver3, diver4]
        }
    }
}

function noStationFourDiversInner(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout | undefined {
    const gates = board.gatesForCell(cell.coords, Direction.In)
    if (gates.length > 0) {
        if (board.numPlayers < 5) {
            const diver1 = centerOffset(center, 17, -1)
            const diver2 = centerOffset(center, 15, 6)
            const diver3 = centerOffset(center, -25, 1)
            const diver4 = centerOffset(center, -7, -10.3)

            return {
                station: undefined,
                divers: [diver1, diver2, diver3, diver4]
            }
        }
    } else {
        const diver1 = centerOffset(center, -5, -2.7)
        const diver2 = centerOffset(center, -20, 8)
        const diver3 = centerOffset(center, -5, 2.7)
        const diver4 = centerOffset(center, -20, -8)

        return {
            station: undefined,
            divers: [diver1, diver2, diver3, diver4]
        }
    }
}

function noStationFourDiversOuter(cell: Cell, center: PolarCoordinates): CellLayout {
    const diver1 = centerOffset(center, 15, -8)
    const diver2 = centerOffset(center, 20, -2.7)
    const diver3 = centerOffset(center, 15, 2.7)
    const diver4 = centerOffset(center, 20, 8)
    return {
        station: undefined,
        divers: [diver1, diver2, diver3, diver4]
    }
}

function noStationFiveDiversCore(cell: Cell, center: PolarCoordinates): CellLayout {
    const diver1 = centerOffset(center, -20, -17)
    const diver2 = centerOffset(center, 20, 0)
    const diver3 = centerOffset(center, 24, -20)
    const diver4 = centerOffset(center, -24, 15)
    const diver5 = centerOffset(center, 24, 22)
    return {
        station: undefined,
        divers: [diver1, diver2, diver3, diver4, diver5]
    }
}

function noStationFiveDiversRadiative(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout {
    const gates = board.gatesForCell(cell.coords, Direction.In)
    if (gates.length > 0) {
        const diver1 = centerOffset(center, 0, -8)
        const diver2 = centerOffset(center, 30, 0)
        const diver3 = centerOffset(center, 30, -16.5)
        const diver4 = centerOffset(center, 0, 8)
        const diver5 = centerOffset(center, 30, 16.5)
        return {
            station: undefined,
            divers: [diver1, diver2, diver3, diver4, diver5]
        }
    } else {
        const diver1 = centerOffset(center, -20, -10)
        const diver2 = centerOffset(center, 20, 0)
        const diver3 = centerOffset(center, 24, -15)
        const diver4 = centerOffset(center, -24, 10)
        const diver5 = centerOffset(center, 24, 15)
        return {
            station: undefined,
            divers: [diver1, diver2, diver3, diver4, diver5]
        }
    }
}

function noStationFiveDiversConvective(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout | undefined {
    const gates = board.gatesForCell(cell.coords, Direction.In)
    if (gates.length > 0) {
        const numInwardNeighbors = board.neighborsAt(cell.coords, Direction.In).length
        if (numInwardNeighbors == 1) {
            const diver1 = centerOffset(center, -20, -9)
            const diver2 = centerOffset(center, 20, 0)
            const diver3 = centerOffset(center, 24, -9)
            const diver4 = centerOffset(center, -24, 9)
            const diver5 = centerOffset(center, 24, 9)
            return {
                station: undefined,
                divers: [diver1, diver2, diver3, diver4, diver5]
            }
        } else {
            const diver1 = centerOffset(center, 0, -5)
            const diver2 = centerOffset(center, 30, 0)
            const diver3 = centerOffset(center, 30, -10)
            const diver4 = centerOffset(center, 0, 5)
            const diver5 = centerOffset(center, 30, 10)
            return {
                station: undefined,
                divers: [diver1, diver2, diver3, diver4, diver5]
            }
        }
    } else {
        const diver1 = centerOffset(center, -20, -5)
        const diver2 = centerOffset(center, 20, 0)
        const diver3 = centerOffset(center, 24, -9)
        const diver4 = centerOffset(center, -24, 5)
        const diver5 = centerOffset(center, 24, 9)
        return {
            station: undefined,
            divers: [diver1, diver2, diver3, diver4, diver5]
        }
    }
}

function noStationFiveDiversInner(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout | undefined {
    const gates = board.gatesForCell(cell.coords, Direction.In)
    if (gates.length === 0) {
        const diver1 = centerOffset(center, 8, -0)
        const diver2 = centerOffset(center, -30, 0)
        const diver3 = centerOffset(center, -30, -7.2)
        const diver4 = centerOffset(center, 8, 6)
        const diver5 = centerOffset(center, -30, 7.2)
        return {
            station: undefined,
            divers: [diver1, diver2, diver3, diver4, diver5]
        }
    }
}

function noStationFiveDiversOuter(cell: Cell, center: PolarCoordinates): CellLayout {
    const diver1 = centerOffset(center, 10, -4)
    const diver2 = centerOffset(center, 27, 0)
    const diver3 = centerOffset(center, 27, -8)
    const diver4 = centerOffset(center, 10, 4)
    const diver5 = centerOffset(center, 27, 8)
    return {
        station: undefined,
        divers: [diver1, diver2, diver3, diver4, diver5]
    }
}

function nonTowerTwoOrLessDiverCore(cell: Cell, center: PolarCoordinates): CellLayout {
    const station = centerOffset(center, -13, 0)
    const diver1 = centerOffset(center, 23, -22)
    const diver2 = centerOffset(center, 23, 22)

    return {
        station: { point: station, z: 1 },
        divers: [diver1, diver2]
    }
}

function nonTowerTwoOrLessDiverNonCore(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout {
    const gates = board.gatesForCell(cell.coords, Direction.In)
    if (board.numPlayers === 5 && cell.coords.row === Ring.Inner && gates.length > 0) {
        const station = centerOffset(center, 10, 2)
        const diver1 = centerOffset(center, -2, -7.7)
        const diver2 = centerOffset(center, -5, 7.7)
        return {
            station: { point: station, z: 1 },
            divers: [diver1, diver2]
        }
    }
    const radiusOffset = gates.length > 0 && cell.coords.row < Ring.Inner ? 15 : 8
    const stationPoint = centerOffset(center, radiusOffset, 0)

    let diver2RadiusOffset = TWO_DIVER_PLUS_STATION_RADIUS_OFFSETS_PER_RING[cell.coords.row]
    let diver1AngleOffset = -TWO_DIVER_PLUS_STATION_ANGLE_OFFSETS_PER_RING[cell.coords.row]
    let diver1RadiusOffset = TWO_DIVER_PLUS_STATION_RADIUS_OFFSETS_PER_RING[cell.coords.row]
    if (cell.coords.row === Ring.Inner && gates.length > 0) {
        diver2RadiusOffset += 15
        if (board.numPlayers < 5) {
            diver1AngleOffset -= 3
        }
        diver1RadiusOffset += 3
    }
    const diver1 = centerOffset(center, diver1RadiusOffset, diver1AngleOffset)
    const diver2 = centerOffset(
        center,
        diver2RadiusOffset,
        TWO_DIVER_PLUS_STATION_ANGLE_OFFSETS_PER_RING[cell.coords.row]
    )
    return {
        station: { point: stationPoint, z: 1 },
        divers: [diver1, diver2]
    }
}

function nonTowerThreeDiverCore(cell: Cell, center: PolarCoordinates): CellLayout {
    const station = centerOffset(center, -22, 0)
    const diver1 = centerOffset(center, 23, -22)
    const diver2 = centerOffset(center, 27, 0)
    const diver3 = centerOffset(center, 23, 22)
    return {
        station: { point: station, z: 1 },
        divers: [diver1, diver2, diver3]
    }
}

function nonTowerThreeDiverRadiative(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout {
    const gates = board.gatesForCell(cell.coords, Direction.In)
    if (gates.length === 0) {
        const station = centerOffset(center, -22, 0)
        const diver1 = centerOffset(center, 10, -13)
        const diver2 = centerOffset(center, 29, 0)
        const diver3 = centerOffset(center, 10, 13)
        return {
            station: { point: station, z: 1 },
            divers: [diver1, diver2, diver3]
        }
    } else {
        const station = centerOffset(center, 12, 4)
        const diver1 = centerOffset(center, 28, -15.7)
        const diver2 = centerOffset(center, 2, -8.5)
        const diver3 = centerOffset(center, 28, 15.7)
        return {
            station: { point: station, z: 1 },
            divers: [diver1, diver2, diver3]
        }
    }
}

function nonTowerThreeDiverConvective(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout | undefined {
    const gates = board.gatesForCell(cell.coords, Direction.In)
    if (gates.length === 0) {
        const station = centerOffset(center, -5, 0)
        const diver1 = centerOffset(center, 10, -9.5)
        const diver2 = centerOffset(center, 22, 9.5)
        const diver3 = centerOffset(center, -22, 9.5)
        return {
            station: { point: station, z: 1 },
            divers: [diver1, diver2, diver3]
        }
    } else {
        const station = centerOffset(center, 18, 2)
        const diver1 = centerOffset(center, 28, -10.5)
        const diver2 = centerOffset(center, 2, -6)
        const diver3 = centerOffset(center, 28, 10)
        return {
            station: { point: station, z: 1 },
            divers: [diver1, diver2, diver3]
        }
    }
}

function nonTowerThreeDiverInner(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout | undefined {
    const gates = board.gatesForCell(cell.coords, Direction.In)
    if (gates.length === 0) {
        const station = centerOffset(center, 5, 0)
        const diver1 = centerOffset(center, -10, -11)
        const diver2 = centerOffset(center, -28, -5.5)
        const diver3 = centerOffset(center, -15, 6)
        return {
            station: { point: station, z: 1 },
            divers: [diver1, diver2, diver3]
        }
    } else if (board.numPlayers < 5) {
        const station = centerOffset(center, 8, 3.7)
        const diver1 = centerOffset(center, -10, -11)
        const diver2 = centerOffset(center, 2, -3)
        const diver3 = centerOffset(center, 5, 10)
        return {
            station: { point: station, z: 1 },
            divers: [diver1, diver2, diver3]
        }
    }
}

function nonTowerThreeDiverOuter(cell: Cell, center: PolarCoordinates): CellLayout | undefined {
    const station = centerOffset(center, 0, 0)
    const diver1 = centerOffset(center, 10, -11)
    const diver2 = centerOffset(center, 18, -6)
    const diver3 = centerOffset(center, 10, 6)
    return {
        station: { point: station, z: 1 },
        divers: [diver1, diver2, diver3]
    }
}

function nonTowerFourDiverCore(cell: Cell, center: PolarCoordinates): CellLayout | undefined {
    const station = centerOffset(center, 22, 0)
    const diver1 = centerOffset(center, -22, -19)
    const diver2 = centerOffset(center, 22, 24)
    const diver3 = centerOffset(center, -22, 19)
    const diver4 = centerOffset(center, 22, -24)
    return {
        station: { point: station, z: 1 },
        divers: [diver1, diver2, diver3, diver4]
    }
}

function nonTowerFourDiverRadiative(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout | undefined {
    const gates = board.gatesForCell(cell.coords, Direction.In)
    if (gates.length === 0) {
        const station = centerOffset(center, -5, 0)
        const diver1 = centerOffset(center, -22, -14)
        const diver2 = centerOffset(center, 22, 14)
        const diver3 = centerOffset(center, -22, 14)
        const diver4 = centerOffset(center, 22, -14)
        return {
            station: { point: station, z: 1 },
            divers: [diver1, diver2, diver3, diver4]
        }
    }
}

function nonTowerFourDiverConvective(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout | undefined {
    const gates = board.gatesForCell(cell.coords, Direction.In)
    if (gates.length === 0) {
        const station = centerOffset(center, -5, 0)
        const diver1 = centerOffset(center, -22, -9.5)
        const diver2 = centerOffset(center, 22, 9)
        const diver3 = centerOffset(center, -22, 9.5)
        const diver4 = centerOffset(center, 22, -9)
        return {
            station: { point: station, z: 1 },
            divers: [diver1, diver2, diver3, diver4]
        }
    }
}

function nonTowerFourDiverInner(
    cell: Cell,
    center: PolarCoordinates,
    board: HydratedSolGameBoard
): CellLayout | undefined {
    const gates = board.gatesForCell(cell.coords, Direction.In)
    if (gates.length === 0) {
        const station = centerOffset(center, 5, 0)
        const diver1 = centerOffset(center, -10, -11)
        const diver2 = centerOffset(center, -28, -5.5)
        const diver3 = centerOffset(center, -10, 6)
        const diver4 = centerOffset(center, -28, 11)
        return {
            station: { point: station, z: 1 },
            divers: [diver1, diver2, diver3, diver4]
        }
    }
}

function nonTowerFourDiverOuter(cell: Cell, center: PolarCoordinates): CellLayout | undefined {
    const station = centerOffset(center, 0, 0)
    const diver1 = centerOffset(center, 10, -11)
    const diver2 = centerOffset(center, 18, -6)
    const diver3 = centerOffset(center, 10, 6)
    const diver4 = centerOffset(center, 18, 11)
    return {
        station: { point: station, z: 1 },
        divers: [diver1, diver2, diver3, diver4]
    }
}
