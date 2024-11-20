import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import {
    coordinatesToNumber,
    Hydratable,
    OffsetCoordinates,
    sameCoordinates
} from '@tabletop/common'
import { Station } from './stations.js'
import { Sundiver } from './sundiver.js'
import { SolarGate } from './solarGate.js'
import { Direction, Ring, SolGraph, SolNode } from '../utils/solGraph.js'
import { flood } from '../utils/floodTraverser.js'
import { HydratedSolPlayerState } from 'src/model/playerState.js'

export type Cell = Static<typeof Cell>
export const Cell = Type.Object({
    coords: OffsetCoordinates,
    station: Station,
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

export class HydratedSolGameBoard extends Hydratable<typeof SolGameBoard> implements SolGameBoard {
    declare numPlayers: number
    declare motherships: Record<string, number>
    declare cells: Record<number, Cell>
    declare gates: Record<string, SolarGate>

    private internalGraph?: SolGraph

    constructor(data: SolGameBoard) {
        super(data, SolGameBoardValidator)
    }

    public reachableCoordinates(coords: OffsetCoordinates, range: number): OffsetCoordinates[] {
        const startNode = this.graph.nodeAt(coords)
        const floodTraverser = flood({
            start: startNode,
            range,
            canTraverse: (from: SolNode, to: SolNode) => {
                // Make sure gate exists if traversing in/out
                if (
                    from.neighbors[Direction.Out].includes(to.coords) ||
                    from.neighbors[Direction.In].includes(to.coords)
                ) {
                    return this.hasGateBetween(from.coords, to.coords)
                }
                return true
            }
        })
        return this.graph.traverse(floodTraverser).map((node) => node.coords)
    }

    public hasGateBetween(coordsA: OffsetCoordinates, coordsB: OffsetCoordinates): boolean {
        for (const gate of Object.values(this.gates)) {
            if (
                (sameCoordinates(gate.innerCoords, coordsA) &&
                    sameCoordinates(gate.outerCoords, coordsB)) ||
                (sameCoordinates(gate.innerCoords, coordsB) &&
                    sameCoordinates(gate.outerCoords, coordsA))
            ) {
                return true
            }
        }
        return false
    }

    public canAddSundiversToCell(
        playerId: string,
        numSundivers: number,
        coords: OffsetCoordinates
    ): boolean {
        if (!this.graph.contains(coords)) {
            return false
        }

        const cell = this.cells[coordinatesToNumber(coords)]
        if (!cell) {
            return true
        }

        return this.sundiversForPlayer(playerId, cell).length + numSundivers <= 5
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
        const secondCol = (mothershipIndex + 1) % numMothershipPositions
        return [
            { row: Ring.Outer, col: mothershipIndex },
            { row: Ring.Inner, col: mothershipIndex },
            { row: Ring.Outer, col: secondCol },
            { row: Ring.Inner, col: secondCol }
        ]
    }

    private sundiversForPlayer(playerId: string, cell: Cell): Sundiver[] {
        return cell.sundivers.filter((sundiver) => sundiver.playerId === playerId)
    }

    get graph(): SolGraph {
        if (!this.internalGraph) {
            this.internalGraph = new SolGraph(this.numPlayers)
        }
        return this.internalGraph
    }
}
