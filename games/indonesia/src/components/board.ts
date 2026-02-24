import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Hydratable } from '@tabletop/common'
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

export type Area = IndonesiaNode & {
    city?: City
    cultivated: boolean
}

export type IndonesiaBoard = Type.Static<typeof IndonesiaBoard>
export const IndonesiaBoard = Type.Object({
    cities: Type.Array(City),
    cultivatedAreas: Type.Array(Type.String())
})

const IndonesiaBoardValidator = Compile(IndonesiaBoard)

export class HydratedIndonesiaBoard
    extends Hydratable<typeof IndonesiaBoard>
    implements IndonesiaBoard, Iterable<IndonesiaNode>
{
    declare cities: City[]
    declare cultivatedAreas: string[]

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

    private nodeAsArea(node: IndonesiaNode): Area {
        return {
            ...node,
            city: this.cities.find((city) => city.area === node.id),
            cultivated: this.cultivatedAreas.includes(node.id)
        }
    }

    getArea(areaId: string): Area | undefined {
        if (!isIndonesiaNodeId(areaId)) {
            return undefined
        }
        const node = this.graph.nodeById(areaId)
        if (!node) {
            return undefined
        }
        return this.nodeAsArea(node)
    }

    public addCity(city: City) {
        this.cities.push(city)
    }

    public areasForRegion(regionId: string): Area[] {
        const region = INDONESIA_REGIONS.find((candidate) => candidate.id === regionId)
        if (!region) {
            return []
        }

        return region.areaIds.map((areaId) => this.getArea(areaId)).filter((area) => !!area)
    }

    public seaAreasForRegion(regionId: string): IndonesiaNodeId[] {
        const graph = this.graph
        const seaAreaIds = new Set<IndonesiaNodeId>()

        for (const area of this.areasForRegion(regionId)) {
            for (const seaAreaId of area.neighbors[IndonesiaNeighborDirection.Sea]) {
                const seaNode = graph.nodeById(seaAreaId)
                if (!seaNode || seaNode.type !== IndonesiaAreaType.Sea) {
                    continue
                }
                seaAreaIds.add(seaAreaId)
            }
        }

        return Array.from(seaAreaIds)
    }

    public coastalAreasForRegion(regionId: string): Area[] {
        const graph = this.graph
        return this.areasForRegion(regionId).filter(
            (area) =>
                area.type === IndonesiaAreaType.Land &&
                area.neighbors[IndonesiaNeighborDirection.Sea].length > 0
        )
    }

    public hasCityInRegion(regionId: string): boolean {
        return this.areasForRegion(regionId).some((area) => !!area.city)
    }

    public isEmptyArea(area: Area): boolean {
        return !area.city && !area.cultivated
    }

    public isCoastalArea(area: Area): boolean {
        return area.neighbors[IndonesiaNeighborDirection.Sea].length > 0
    }
}
