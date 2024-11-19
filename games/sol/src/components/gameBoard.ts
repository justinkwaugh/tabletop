import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Hydratable, OffsetCoordinates, sameCoordinates } from '@tabletop/common'
import { Station } from './stations.js'
import { Sundiver } from './sundiver.js'
import { SolarGate } from './solarGate.js'
import { Direction, Ring, SolGraph, SolNode } from '../utils/solGraph.js'
import { flood } from '../utils/floodTraverser.js'

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

    public launchCoordinates(playerId: string): OffsetCoordinates[] {
        const mothershipIndex = this.motherships[playerId]
        if (mothershipIndex === undefined) {
            return []
        }

        const results = this.launchCoordinatesForMothership(mothershipIndex)

        // If portal, add all other mothership positions

        return results
    }

    private launchCoordinatesForMothership(mothershipIndex: number): OffsetCoordinates[] {
        const numMothershipPositions = this.numPlayers === 5 ? 16 : 13
        const secondCol = (mothershipIndex + 1) % numMothershipPositions
        return [
            { row: Ring.Outer, col: mothershipIndex },
            { row: Ring.Inner, col: mothershipIndex },
            { row: Ring.Outer, col: secondCol },
            { row: Ring.Inner, col: secondCol }
        ]
    }

    get graph(): SolGraph {
        if (!this.internalGraph) {
            this.internalGraph = new SolGraph(this.numPlayers)
        }
        return this.internalGraph
    }
}
