import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Building } from './building.js'
import { Passenger } from './passenger.js'
import { assert, Hydratable } from '@tabletop/common'
import {
    BuildingSite,
    BuildingSites,
    BusGraph,
    BusNode,
    BusNodeId,
    BusStationId
} from '../utils/busGraph.js'

export type GameBoard = Type.Static<typeof GameBoard>
export const GameBoard = Type.Object({
    buildings: Type.Record(Type.String(), Building), // Buildings by site ID
    passengers: Type.Array(Passenger)
})

export const GameBoardValidator = Compile(GameBoard)

export class HydratedGameBoard
    extends Hydratable<typeof GameBoard>
    implements GameBoard, Iterable<BusNode>
{
    declare buildings: Record<string, Building>
    declare passengers: Passenger[]

    private internalGraph?: BusGraph;

    *[Symbol.iterator](): IterableIterator<BusNode> {
        yield* Iterator.from(this.graph)
    }

    constructor(data: GameBoard) {
        super(data, GameBoardValidator)
        this.internalGraph = undefined
    }

    get graph(): BusGraph {
        if (!this.internalGraph) {
            this.internalGraph = new BusGraph()
        }
        return this.internalGraph
    }

    addPassengers(passengers: Passenger[], stationId: BusStationId) {
        for (const passenger of passengers) {
            passenger.nodeId = stationId
        }

        this.passengers.push(...passengers)
    }

    passengersAtNode(nodeId: string): Passenger[] {
        return this.passengers.filter(
            (passenger) => passenger.nodeId === nodeId && !passenger.siteId
        )
    }

    passengerAtSite(buildingId: string): Passenger | undefined {
        return this.passengers.find((passenger) => passenger.nodeId === buildingId)
    }

    passengersByNode(): Record<BusNodeId, Passenger[]> {
        const mapping: Record<string, Passenger[]> = {}
        for (const passenger of this.passengers) {
            if (!passenger.nodeId || passenger.siteId) {
                continue
            }
            if (!mapping[passenger.nodeId]) {
                mapping[passenger.nodeId] = []
            }
            mapping[passenger.nodeId].push(passenger)
        }
        return mapping
    }

    hasBuildingAt(siteId: string): boolean {
        return !!this.buildings[siteId]
    }

    addBuilding(building: Building) {
        assert(
            !this.hasBuildingAt(building.site),
            `There is already a building at site ${building.site}`
        )
        this.buildings[building.site] = building
    }

    openSitesForPhase(phase: number): BuildingSite[] {
        return Object.values(BuildingSites).filter(
            (site) => site.value == phase && !this.hasBuildingAt(site.id)
        )
    }
}
