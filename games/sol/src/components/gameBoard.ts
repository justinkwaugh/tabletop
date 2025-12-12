import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import {
    coordinatesToNumber,
    Hydratable,
    OffsetCoordinates,
    sameCoordinates,
    szudzikPairSigned
} from '@tabletop/common'
import { Station, StationType } from './stations.js'
import { Sundiver } from './sundiver.js'
import { SolarGate } from './solarGate.js'
import {
    Direction,
    FIVE_PLAYER_RING_COUNTS,
    ONE_TO_FOUR_PLAYER_RING_COUNTS,
    Ring,
    SolGraph
} from '../utils/solGraph.js'
import { solTraverser } from '../utils/solTraverser.js'
import { solPathfinder } from '../utils/solPathfinder.js'
import { solRingPattern } from '../utils/solRingPattern.js'

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

export const CENTER_COORDS = { row: Ring.Center, col: 0 } satisfies OffsetCoordinates
export const SolGameBoardValidator = Compile(SolGameBoard)

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
        yield* Iterator.from(this.graph).map((node) => {
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

    get numMothershipLocations(): number {
        const outerSpaces =
            this.numPlayers === 5
                ? FIVE_PLAYER_RING_COUNTS[Ring.Outer]
                : ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Outer]
        return outerSpaces - 1
    }

    private emptyCell(coords: OffsetCoordinates): Cell {
        return {
            coords: coords,
            station: undefined,
            sundivers: []
        }
    }
    public cellAt(coords: OffsetCoordinates): Cell {
        return this.cells[coordinatesToNumber(coords)] ?? this.emptyCell(coords)
    }

    public setCell(cell: Cell) {
        this.cells[coordinatesToNumber(cell.coords)] = cell
    }

    public neighborsAt(coords: OffsetCoordinates, direction: Direction): Cell[] {
        return this.graph
            .neighborsAt(coords, direction)
            .map((neighbor) => this.cellAt(neighbor.coords))
    }

    public areNeighbors(coordsA: OffsetCoordinates, coordsB: OffsetCoordinates): boolean {
        const aNeighbors = this.graph.neighborsAt(coordsA)
        return aNeighbors.some((neighbor) => sameCoordinates(neighbor.coords, coordsB))
    }

    public hasGateBetween(coordsA: OffsetCoordinates, coordsB: OffsetCoordinates): boolean {
        const gateKey = this.gateKey(coordsA, coordsB)
        return !!this.gates[gateKey]
    }

    public isGateBetween(
        gate: SolarGate,
        coordsA: OffsetCoordinates,
        coordsB: OffsetCoordinates
    ): boolean {
        if (!gate.innerCoords || !gate.outerCoords) {
            return false
        }
        const gateKey = this.gateKey(coordsA, coordsB)
        return gateKey === this.gateKey(gate.innerCoords, gate.outerCoords)
    }

    public findGatesLocalToRing(ring: Ring): SolarGate[] {
        return Object.values(this.gates).filter((gate) => {
            // Core to convective, have to match inner or outer
            if (
                ring >= Ring.Core &&
                ring <= Ring.Convective &&
                (gate.innerCoords?.row === ring || gate.outerCoords?.row === ring)
            ) {
                return true
            }

            // Inner and outer, only match outer
            if (ring >= Ring.Inner && gate.outerCoords?.row === Ring.Inner) {
                return true
            }

            return false
        })
    }

    public gateChoicesForDestination({
        start,
        end,
        range,
        requiredGates,
        allowLoops = false,
        portal = false
    }: {
        start: OffsetCoordinates
        end: OffsetCoordinates
        range?: number
        requiredGates?: SolarGate[]
        allowLoops?: boolean
        portal?: boolean
    }): SolarGate[] {
        const path = [start]

        // First travel through any required gates
        if (requiredGates && requiredGates.length > 0) {
            const requiredPath = this.pathThroughGates({ start, requiredGates, range, portal })
            if (!requiredPath) {
                return []
            }
            path.push(...requiredPath.slice(1))
        }

        // Now search from here
        const current = path.at(-1)!
        // If we've reached the destination, we're done
        if (sameCoordinates(current, end)) {
            return []
        }

        const localGates = this.findGatesLocalToRing(current.row)
        const remainingRange = range !== undefined ? range - (path.length - 1) : undefined

        // Check each gate to see if the path from the opposite side of the gate to the destination is valid
        return localGates.filter((gate) => {
            if (!gate.innerCoords || !gate.outerCoords) {
                return false
            }

            // First travel through the gate
            const pathThroughGate = this.pathThroughGates({
                start: current,
                requiredGates: [gate],
                range: remainingRange,
                illegalCoordinates: allowLoops ? undefined : path,
                portal
            })

            if (!pathThroughGate || pathThroughGate.length < 2) {
                return false
            }

            const otherSideOfGate = pathThroughGate.at(-1)!

            // We might just be done
            if (sameCoordinates(end, otherSideOfGate)) {
                return true
            }

            const distanceTraveled = pathThroughGate.length - 1

            if (remainingRange !== undefined && distanceTraveled >= remainingRange) {
                return false
            }

            const extendedPath = path.concat(pathThroughGate.slice(1))

            // Check path from other side of gate to destination
            const pathFromGate = this.pathToDestination({
                start: otherSideOfGate,
                destination: end,
                range: remainingRange !== undefined ? remainingRange - distanceTraveled : undefined,
                illegalCoordinates: allowLoops ? undefined : extendedPath,
                portal
            })

            return pathFromGate !== undefined && pathFromGate.length >= 2
        })
    }

    public pathToDestination({
        start,
        destination,
        range,
        requiredGates, // Ordered list of gates to pass through
        illegalCoordinates,
        portal = false
    }: {
        start: OffsetCoordinates
        destination: OffsetCoordinates
        range?: number
        requiredGates?: SolarGate[]
        illegalCoordinates?: OffsetCoordinates[]
        portal?: boolean
    }): OffsetCoordinates[] | undefined {
        const path = [start]

        if (requiredGates && requiredGates.length > 0) {
            const pathThroughGates = this.pathThroughGates({
                start,
                requiredGates,
                range,
                portal
            })
            if (!pathThroughGates) {
                return undefined
            }
            path.push(...pathThroughGates.slice(1))
        }

        let remainingRange = range !== undefined ? range - (path.length - 1) : undefined
        let current = path.at(-1)!

        if (!sameCoordinates(current, destination)) {
            if (portal) {
                this.graph.setPortals(Object.values(this.motherships))
            }
            try {
                const pathFinder = solPathfinder({
                    board: this,
                    start: current,
                    end: destination,
                    range: remainingRange,
                    illegalCoordinates
                })
                const finalSegment = this.graph.findFirstPath(pathFinder)
                if (!finalSegment) {
                    return undefined
                }
                path.push(...finalSegment.slice(1).map((node) => node.coords))
            } finally {
                if (portal) {
                    this.graph.clearPortals()
                }
            }
        }
        return path.length > 0 ? path : undefined
    }

    public pathThroughGates({
        start,
        requiredGates, // Ordered list of gates to pass through
        range,
        illegalCoordinates,
        portal = false
    }: {
        start: OffsetCoordinates
        requiredGates?: SolarGate[]
        range?: number
        illegalCoordinates?: OffsetCoordinates[]
        portal?: boolean
    }): OffsetCoordinates[] | undefined {
        const path = [start]
        let current = start
        let remainingRange = range

        if (portal) {
            this.graph.setPortals(Object.values(this.motherships))
        }

        try {
            for (const gate of requiredGates || []) {
                if (!gate.innerCoords || !gate.outerCoords) {
                    return undefined
                }
                const nextDestination =
                    current.row <= gate.innerCoords.row ? gate.outerCoords : gate.innerCoords

                const pathFinder = solPathfinder({
                    board: this,
                    start: current,
                    end: nextDestination,
                    allowedGates: [gate],
                    range: remainingRange,
                    illegalCoordinates
                })
                const segment = this.graph.findFirstPath(pathFinder)
                if (!segment) {
                    return undefined
                }
                path.push(...segment.slice(1).map((node) => node.coords))

                if (remainingRange !== undefined) {
                    remainingRange -= segment.length - 1
                }
                current = nextDestination
            }
        } finally {
            if (portal) {
                this.graph.clearPortals()
            }
        }
        return path.length > 0 ? path : undefined
    }

    public requiresGateBetween(start: OffsetCoordinates, end: OffsetCoordinates): boolean {
        if (start.row === end.row) {
            return false
        }
        const innerOuter = [Ring.Inner, Ring.Outer]
        if (innerOuter.includes(start.row) && innerOuter.includes(end.row)) {
            return false
        }
        return true
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
        if (coords.row === Ring.Center) {
            return false
        }

        if (!this.graph.hasAt(coords)) {
            return false
        }

        const cell = this.cells[coordinatesToNumber(coords)]
        return !cell || !cell.station
    }

    public addStationAt(station: Station, coords: OffsetCoordinates) {
        let cell = this.cellAt(coords)
        station.coords = coords
        cell.station = station
        this.setCell(cell)
    }

    public removeStationAt(coords: OffsetCoordinates): Station | undefined {
        let cell = this.cellAt(coords)
        const station = cell.station
        if (!station) {
            return undefined
        }

        cell.station = undefined
        station.coords = undefined
        this.setCell(cell)
        return station
    }

    public addSundiversToCell(sundivers: Sundiver[], coords: OffsetCoordinates) {
        const sundiversByPlayer: Record<string, Sundiver[]> = {}
        for (const sundiver of sundivers) {
            sundiver.coords = coords
            if (!sundiversByPlayer[sundiver.playerId]) {
                sundiversByPlayer[sundiver.playerId] = []
            }
            sundiversByPlayer[sundiver.playerId].push(sundiver)
        }

        let cell = this.cellAt(coords)

        for (const [playerId, sundivers] of Object.entries(sundiversByPlayer)) {
            if (!this.canAddSundiversToCell(playerId, sundivers.length, coords)) {
                throw new Error('Cannot add sundivers to cell')
            }
            cell.sundivers.push(...sundivers)
        }

        this.setCell(cell)
    }

    public removeSundiversAt(sundiverIds: string[], coords: OffsetCoordinates): Sundiver[] {
        const cell = this.cells[coordinatesToNumber(coords)]
        if (!cell) {
            throw new Error('No sundivers to remove')
        }

        return this.removeSundiversFromCell(sundiverIds, cell)
    }

    public removeSundiversFromCell(
        sundiverIds: string[],
        cell: Cell,
        requireAll: boolean = true
    ): Sundiver[] {
        const removedSundivers = cell.sundivers.filter((sundiver) =>
            sundiverIds.includes(sundiver.id)
        )
        if (requireAll && removedSundivers.length !== sundiverIds.length) {
            throw new Error(`Could not find sundivers to remove`)
        }
        cell.sundivers = cell.sundivers.filter((sundiver) => !sundiverIds.includes(sundiver.id))

        for (const sundiver of removedSundivers) {
            sundiver.coords = undefined
        }
        return removedSundivers
    }

    // Could be more efficient
    public removeSundiversFromBoard(sundiverIds: string[]): Sundiver[] {
        const removedDivers = []
        for (const cell of this) {
            removedDivers.push(...this.removeSundiversFromCell(sundiverIds, cell, false))
            if (removedDivers.length === sundiverIds.length) {
                break
            }
        }
        return removedDivers
    }

    public launchCoordinatesForMothership(
        playerId: string,
        portal: boolean = false
    ): OffsetCoordinates[] {
        const mothershipIndices = portal
            ? Object.values(this.motherships)
            : [this.motherships[playerId]]

        return mothershipIndices.reduce((acc: OffsetCoordinates[], mothershipIndex: number) => {
            acc.push(...this.graph.mothershipAdjacentCoords(mothershipIndex))
            return acc
        }, [])
    }

    public playersWithSundiversAt(coords: OffsetCoordinates): string[] {
        const cell = this.cellAt(coords)
        return this.playersWithSundivers(cell)
    }

    public playersWithSundivers(cell: Cell): string[] {
        return Array.from(new Set(cell.sundivers.map((sundiver) => sundiver.playerId)))
    }

    public sundiversForPlayerAt(playerId: string, coords: OffsetCoordinates): Sundiver[] {
        const cell = this.cells[coordinatesToNumber(coords)]
        return this.sundiversForPlayer(playerId, cell)
    }

    public sundiversForPlayer(playerId: string, cell: Cell | undefined): Sundiver[] {
        if (!cell) {
            return []
        }
        return cell.sundivers.filter((sundiver) => sundiver.playerId === playerId)
    }

    public findSundiverCoords(sundiverId: string): OffsetCoordinates | undefined {
        for (const [key, cell] of Object.entries(this.cells)) {
            if (cell.sundivers.find((diver) => diver.id === sundiverId)) {
                return cell.coords
            }
        }
        return undefined
    }

    public hasStationAt(coords: OffsetCoordinates, playerId?: string): boolean {
        const cell = this.cellAt(coords)
        if (!cell.station) {
            return false
        }
        if (playerId && cell.station.playerId !== playerId) {
            return false
        }
        return true
    }

    public findStation(stationId: string): Station | undefined {
        for (const [key, cell] of Object.entries(this.cells)) {
            if (cell.station?.id === stationId) {
                return cell.station
            }
        }
        return undefined
    }

    public gateKey(coordsA: OffsetCoordinates, coordsB: OffsetCoordinates) {
        const [innerCoords, outerCoords] =
            coordsA.row < coordsB.row ? [coordsA, coordsB] : [coordsB, coordsA]
        return szudzikPairSigned(coordinatesToNumber(innerCoords), coordinatesToNumber(outerCoords))
    }

    public canConvertGateAt(playerId: string, coords: OffsetCoordinates): boolean {
        if (coords.row === Ring.Core) {
            return false
        }
        const cell = this.cellAt(coords)

        const innerNeighbors = this.graph.neighborsAt(coords, Direction.In)
        const openGateSpots = Iterator.from(innerNeighbors).some((neighbor) => {
            return !this.hasGateBetween(coords, neighbor.coords)
        })
        if (!openGateSpots) {
            return false
        }

        const localSundivers = this.sundiversForPlayer(playerId, cell)
        if (localSundivers.length === 0) {
            return false
        }
        const outwardNeighbors = this.graph.neighborsAt(coords, Direction.Out)
        for (const neighbor of outwardNeighbors) {
            if (this.sundiversForPlayerAt(playerId, neighbor.coords).length > 0) {
                return true
            }
        }
        return false
    }

    public gateConversionDestinations(coords: OffsetCoordinates): OffsetCoordinates[] {
        const destinations: OffsetCoordinates[] = []
        return this.graph
            .neighborsAt(coords, Direction.In)
            .filter((neighbor) => {
                return !this.hasGateBetween(coords, neighbor.coords)
            })
            .map((neighbor) => neighbor.coords)
    }

    public canConvertStationAt(
        playerId: string,
        stationType: StationType,
        coords: OffsetCoordinates
    ): boolean {
        if (!this.canAddStationToCell(coords)) {
            return false
        }

        // Check either side
        if (stationType === StationType.EnergyNode) {
            const ccwNeighborCoords = this.graph.neighborsAt(coords, Direction.CounterClockwise)[0]
                ?.coords
            const cwNeighborCoords = this.graph.neighborsAt(coords, Direction.Clockwise)[0]?.coords

            return (
                this.sundiversForPlayerAt(playerId, ccwNeighborCoords).length > 0 &&
                this.sundiversForPlayerAt(playerId, cwNeighborCoords).length > 0
            )
        }

        // Check self and neighbor
        if (stationType === StationType.SundiverFoundry) {
            const localSundivers = this.sundiversForPlayerAt(playerId, coords)
            const ccwNeighborCoords = this.graph.neighborsAt(coords, Direction.CounterClockwise)[0]
                ?.coords
            const cwNeighborCoords = this.graph.neighborsAt(coords, Direction.Clockwise)[0]?.coords

            return (
                localSundivers.length > 0 &&
                (this.sundiversForPlayerAt(playerId, ccwNeighborCoords).length > 0 ||
                    this.sundiversForPlayerAt(playerId, cwNeighborCoords).length > 0)
            )
        }

        if (stationType === StationType.TransmitTower) {
            if (coords.row > Ring.Convective) {
                return false
            }
            const localSundivers = this.sundiversForPlayerAt(playerId, coords)
            if (localSundivers.length === 0) {
                return false
            }

            const outwardNeighbors = this.graph.neighborsAt(coords, Direction.Out)
            for (const neighbor of outwardNeighbors) {
                if (this.sundiversForPlayerAt(playerId, neighbor.coords).length === 0) {
                    continue
                }
                const thirdOuterNeighbors = this.graph.neighborsAt(neighbor.coords, Direction.Out)
                for (const thirdNeighbor of thirdOuterNeighbors) {
                    if (this.sundiversForPlayerAt(playerId, thirdNeighbor.coords).length > 0) {
                        return true
                    }
                }
            }
            return false
        }

        return false
    }

    hasStationInRing(playerId: string, ring: Ring): boolean {
        if (ring === Ring.Center) {
            return false
        }
        const ringPattern = solRingPattern({ numPlayers: this.numPlayers, ring })
        return Iterator.from(this.graph.traversePattern(ringPattern)).some(
            (node) => this.cellAt(node.coords).station?.playerId === playerId
        )
    }

    stationsInRing(ring: Ring, playerId?: string): Station[] {
        if (ring === Ring.Center) {
            return []
        }
        const ringPattern = solRingPattern({ numPlayers: this.numPlayers, ring })
        return Array.from(
            Iterator.from(this.graph.traversePattern(ringPattern))
                .map((node) => {
                    const cell = this.cellAt(node.coords)
                    if (!playerId || cell.station?.playerId === playerId) {
                        return cell.station
                    }
                    return undefined
                })
                .filter((station): station is Station => station !== undefined)
        )
    }

    hasStationOnBoard(playerId: string): boolean {
        return Iterator.from(this).some((cell) => cell.station?.playerId === playerId)
    }

    get graph(): SolGraph {
        if (!this.internalGraph) {
            this.internalGraph = new SolGraph(this.numPlayers)
        }
        return this.internalGraph
    }
}
