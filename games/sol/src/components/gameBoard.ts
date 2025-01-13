import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import {
    coordinatesToNumber,
    Hydratable,
    OffsetCoordinates,
    sameCoordinates,
    szudzikPairSigned
} from '@tabletop/common'
import { Station } from './stations.js'
import { Sundiver } from './sundiver.js'
import { SolarGate } from './solarGate.js'
import { Direction, Ring, SolGraph } from '../utils/solGraph.js'
import { solTraverser } from '../utils/solTraverser.js'
import { solPathfinder } from '../utils/solPathfinder.js'

export type Cell = Static<typeof Cell>
export const Cell = Type.Object({
    coords: OffsetCoordinates,
    station: Type.Optional(Station),
    sundivers: Type.Array(Sundiver)
})

export type SolGameBoard = Static<typeof SolGameBoard>
export const SolGameBoard = Type.Object({
    numPlayers: Type.Number(),
    motherships: Type.Record(Type.String(), Type.Number()), // PlayerId -> Index
    cells: Type.Record(Type.Number(), Cell),
    gates: Type.Record(Type.String(), SolarGate)
})

export const SolGameBoardValidator = TypeCompiler.Compile(SolGameBoard)

export class HydratedSolGameBoard
    extends Hydratable<typeof SolGameBoard>
    implements SolGameBoard, Iterable<Cell>
{
    declare numPlayers: number
    declare motherships: Record<string, number>
    declare cells: Record<number, Cell>
    declare gates: Record<number, SolarGate>

    private internalGraph?: SolGraph;

    *[Symbol.iterator](): IterableIterator<Cell> {
        yield* this.graph.map((node) => {
            const cell = this.cells[coordinatesToNumber(node.coords)]
            if (cell) {
                return cell
            } else {
                return {
                    coords: node.coords,
                    station: undefined,
                    sundivers: []
                }
            }
        })
    }

    constructor(data: SolGameBoard) {
        super(data, SolGameBoardValidator)
        this.internalGraph = undefined
    }

    public cellAt(coords: OffsetCoordinates): Cell {
        return this.cells[coordinatesToNumber(coords)]
    }

    public reachableCoordinates(coords: OffsetCoordinates, range: number): OffsetCoordinates[] {
        const traverser = solTraverser({ board: this, start: coords, range })
        return this.graph.traverse(traverser).map((node) => node.coords)
    }

    public hasGateBetween(coordsA: OffsetCoordinates, coordsB: OffsetCoordinates): boolean {
        const gateKey = this.gateKey(coordsA, coordsB)
        return !!this.gates[gateKey]
    }

    public gateChoicesForDestination(
        start: OffsetCoordinates,
        destination: OffsetCoordinates,
        range: number
    ): SolarGate[] {
        const localGates = Object.values(this.gates).filter((gate) => {
            if (
                start.row >= Ring.Core &&
                start.row <= Ring.Convective &&
                gate.innerCoords!.row !== start.row &&
                gate.outerCoords!.row !== start.row
            ) {
                return false
            }
            if (start.row >= Ring.Inner && gate.outerCoords!.row !== start.row) {
                return false
            }
            return true
        })

        return localGates.filter((gate) => {
            if (!gate.innerCoords || !gate.outerCoords) {
                return false
            }

            // Check path to gate
            const gateDestination =
                start.row <= gate.innerCoords.row ? gate.outerCoords : gate.innerCoords

            const pathToGate = this.pathToDestination(start, gateDestination, range)
            if (!pathToGate) {
                return false
            }
            const distanceTraveled = pathToGate.length - 1
            if (distanceTraveled > range) {
                return false
            }

            if (distanceTraveled === range) {
                return sameCoordinates(destination, gateDestination)
            }

            // Check path from gate to destination
            const pathFromGate = this.pathToDestination(gateDestination, destination, range)
            if (!pathFromGate) {
                return false
            }

            const totalDistance = distanceTraveled + pathFromGate.length - 1
            return totalDistance <= range
        })
    }

    public pathToDestination(
        start: OffsetCoordinates,
        destination: OffsetCoordinates,
        range?: number
    ): OffsetCoordinates[] | undefined {
        const pathFinder = solPathfinder({
            board: this,
            start,
            end: destination,
            range
        })
        const paths = this.graph.findPaths(pathFinder)
        return paths.length > 0 ? paths[0].map((node) => node.coords) : undefined
    }

    public gatesForCell(
        coords: OffsetCoordinates,
        direction: Direction.In | Direction.Out
    ): (SolarGate | undefined)[] {
        return this.graph.neighborsAt(coords, direction).map((neighbor) => {
            const gateKey = this.gateKey(coords, neighbor.coords)
            return this.gates[gateKey]
        })
    }

    public addGateAt(
        gate: SolarGate,
        innerCoords: OffsetCoordinates,
        outerCoords: OffsetCoordinates
    ) {
        const gateKey = this.gateKey(innerCoords, outerCoords)
        if (this.gates[gateKey]) {
            throw new Error(
                `Gate already exists at ${JSON.stringify(innerCoords)}, ${JSON.stringify(outerCoords)}`
            )
        }

        // make sure coords are adjacent
        const innerNode = this.graph.nodeAt(innerCoords)
        const outerNode = this.graph.nodeAt(outerCoords)
        if (
            !innerNode ||
            !outerNode ||
            !this.graph.neighborsOf(innerNode, Direction.Out).includes(outerNode)
        ) {
            throw new Error(
                `Invalid gate coordinates: ${JSON.stringify(innerCoords)}, ${JSON.stringify(outerCoords)}`
            )
        }

        gate.innerCoords = innerCoords
        gate.outerCoords = outerCoords
        this.gates[gateKey] = gate
    }

    public canAddSundiversToCell(
        playerId: string,
        numSundivers: number,
        coords: OffsetCoordinates
    ): boolean {
        if (!this.graph.hasAt(coords)) {
            return false
        }

        const cell = this.cells[coordinatesToNumber(coords)]
        if (!cell) {
            return true
        }

        return this.sundiversForPlayer(playerId, cell).length + numSundivers <= 5
    }

    public canAddStationToCell(coords: OffsetCoordinates): boolean {
        if (!this.graph.hasAt(coords)) {
            return false
        }

        const cell = this.cells[coordinatesToNumber(coords)]
        return !cell || !cell.station
    }

    public addSundiversToCell(sundivers: Sundiver[], coords: OffsetCoordinates) {
        const sundiversByPlayer: Record<string, Sundiver[]> = {}
        for (const sundiver of sundivers) {
            if (!sundiversByPlayer[sundiver.playerId]) {
                sundiversByPlayer[sundiver.playerId] = []
            }
            sundiversByPlayer[sundiver.playerId].push(sundiver)
        }

        let cell = this.cells[coordinatesToNumber(coords)]
        if (!cell) {
            cell = {
                coords,
                station: Station.None,
                sundivers: []
            }
            this.cells[coordinatesToNumber(coords)] = cell
        }

        for (const [playerId, sundivers] of Object.entries(sundiversByPlayer)) {
            if (!this.canAddSundiversToCell(playerId, sundivers.length, coords)) {
                throw new Error('Cannot add sundivers to cell')
            }
            cell.sundivers.push(...sundivers)
        }
    }

    public launchCoordinatesForMothership(playerId: string): OffsetCoordinates[] {
        const mothershipIndex = this.motherships[playerId]
        if (mothershipIndex === undefined) {
            return []
        }
        const numMothershipPositions = this.numPlayers === 5 ? 16 : 13
        const secondCol = (mothershipIndex + numMothershipPositions - 1) % numMothershipPositions
        return [
            { row: Ring.Outer, col: mothershipIndex },
            { row: Ring.Inner, col: mothershipIndex },
            { row: Ring.Outer, col: secondCol },
            { row: Ring.Inner, col: secondCol }
        ]
    }

    public sundiversForPlayer(playerId: string, cell: Cell): Sundiver[] {
        return cell.sundivers.filter((sundiver) => sundiver.playerId === playerId)
    }

    private gateKey(coordsA: OffsetCoordinates, coordsB: OffsetCoordinates) {
        const [innerCoords, outerCoords] =
            coordsA.row < coordsB.row ? [coordsA, coordsB] : [coordsB, coordsA]
        return szudzikPairSigned(coordinatesToNumber(innerCoords), coordinatesToNumber(outerCoords))
    }

    get graph(): SolGraph {
        if (!this.internalGraph) {
            this.internalGraph = new SolGraph(this.numPlayers)
        }
        return this.internalGraph
    }
}
