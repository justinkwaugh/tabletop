import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assert, assertExists, Hydratable } from '@tabletop/common'
import { IndonesiaGraph } from '../utils/indonesiaGraph.js'
import {
    IndonesiaAreaType,
    IndonesiaNeighborDirection,
    isIndonesiaNodeId,
    type IndonesiaNode,
    type IndonesiaNodeId
} from '../utils/indonesiaNodes.js'
import { INDONESIA_REGIONS } from '../utils/regions.js'
import { City } from './city.js'
import {
    Area,
    AreaType,
    CityArea,
    isCityArea,
    isCultivatedArea,
    isLandArea,
    isSeaArea,
    type LandArea,
    SeaArea
} from './area.js'

export type AreaNode = IndonesiaNode & Area

export type IndonesiaBoard = Type.Static<typeof IndonesiaBoard>
export const IndonesiaBoard = Type.Object({
    cities: Type.Array(City),
    areas: Type.Record(Type.String(), Area)
})

const IndonesiaBoardValidator = Compile(IndonesiaBoard)

export class HydratedIndonesiaBoard
    extends Hydratable<typeof IndonesiaBoard>
    implements IndonesiaBoard, Iterable<IndonesiaNode>
{
    declare cities: City[]
    declare areas: Record<string, Area>

    private internalGraph?: IndonesiaGraph;

    *[Symbol.iterator](): IterableIterator<IndonesiaNode> {
        yield* Iterator.from(this.graph)
    }

    constructor(data: IndonesiaBoard) {
        super(data, IndonesiaBoardValidator)
        this.internalGraph = undefined
    }

    get graph(): IndonesiaGraph {
        if (!this.internalGraph) {
            this.internalGraph = new IndonesiaGraph()
        }
        return this.internalGraph
    }

    getArea(areaId: string): Area {
        const area = this.areas[areaId]
        if (area) {
            return area
        }

        assert(
            isIndonesiaNodeId(areaId),
            `Area with id ${areaId} not found and is not a valid IndonesiaNodeId`
        )
        const node = this.graph.nodeById(areaId)
        assertExists(
            node,
            `Area with id ${areaId} not found in areas and no node found for id in graph`
        )

        if (node.type === IndonesiaAreaType.Land) {
            return {
                id: node.id,
                type: AreaType.EmptyLand
            } satisfies LandArea
        } else {
            return {
                id: node.id,
                type: AreaType.Sea,
                ships: []
            } satisfies SeaArea
        }
    }

    getNodeForArea(area: Area): IndonesiaNode {
        if (!isIndonesiaNodeId(area.id)) {
            throw Error(`Invalid area id ${area.id} is not a valid IndonesiaNodeId`)
        }

        const node = this.graph.nodeById(area.id)
        assert(node, `No node found for area with id ${area.id}`)
        return node
    }

    public addCity(city: City) {
        this.cities.push(city)
        const cityArea: CityArea = {
            id: city.area,
            type: AreaType.City,
            cityId: city.id
        }
        this.areas[city.area] = cityArea
    }

    public areasForRegion(regionId: string): LandArea[] {
        const region = INDONESIA_REGIONS.find((candidate) => candidate.id === regionId)
        if (!region) {
            return []
        }

        return region.areaIds
            .map((areaId) => this.getArea(areaId))
            .filter((area) => isLandArea(area))
    }

    public seaAreasForRegion(regionId: string): SeaArea[] {
        const graph = this.graph
        const seaAreaIds = new Set<IndonesiaNodeId>()

        for (const node of this.areasForRegion(regionId).map((area) => this.getNodeForArea(area))) {
            for (const seaAreaId of node.neighbors[IndonesiaNeighborDirection.Sea]) {
                const seaNode = graph.nodeById(seaAreaId)
                if (!seaNode || seaNode.type !== IndonesiaAreaType.Sea) {
                    continue
                }
                seaAreaIds.add(seaAreaId)
            }
        }

        return Array.from(seaAreaIds)
            .map((seaAreaId) => this.getArea(seaAreaId))
            .filter((area) => isSeaArea(area))
    }

    public coastalAreasForRegion(regionId: string): LandArea[] {
        const graph = this.graph
        return this.areasForRegion(regionId).filter((area) => this.isCoastalArea(area))
    }

    public hasCityInRegion(regionId: string): boolean {
        return this.areasForRegion(regionId).some((area) => isCityArea(area))
    }

    public isInRegion(area: Area, regionId: string): boolean {
        const region = INDONESIA_REGIONS.find((candidate) => candidate.id === regionId)
        assertExists(
            region,
            `Invalid region id ${regionId} does not correspond to any known region`
        )
        return region.areaIds.some((areaId) => areaId === area.id)
    }

    public isCoastalArea(area: Area): boolean {
        const node = this.getNodeForArea(area)
        if (node.type !== IndonesiaAreaType.Land) {
            return false
        }
        return node.neighbors[IndonesiaNeighborDirection.Sea].length > 0
    }

    public hasCultivatedNeighbors(area: Area): boolean {
        const node = this.getNodeForArea(area)
        return this.graph
            .neighborsOf(node, IndonesiaNeighborDirection.Land)
            .some((neighbor) => isCultivatedArea(this.getArea(neighbor.id)))
    }
}
