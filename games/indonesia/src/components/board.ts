import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Hydratable } from '@tabletop/common'
import { IndonesiaGraph } from '../utils/indonesiaGraph.js'
import {
    IndonesiaAreaType,
    IndonesiaNeighborDirection,
    type IndonesiaNode,
    type IndonesiaNodeId
} from '../utils/indonesiaNodes.js'
import { INDONESIA_REGIONS } from '../utils/regions.js'
import { City } from './city.js'

export type IndonesiaBoard = Type.Static<typeof IndonesiaBoard>
export const IndonesiaBoard = Type.Object({
    cities: Type.Array(City)
})

const IndonesiaBoardValidator = Compile(IndonesiaBoard)

export class HydratedIndonesiaBoard
    extends Hydratable<typeof IndonesiaBoard>
    implements IndonesiaBoard, Iterable<IndonesiaNode>
{
    declare cities: City[]

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

    public seaAreasForRegion(regionId: string): IndonesiaNodeId[] {
        const region = INDONESIA_REGIONS.find((candidate) => candidate.id === regionId)
        if (!region) {
            return []
        }

        const graph = this.graph
        const seaAreaIds = new Set<IndonesiaNodeId>()

        for (const landAreaId of region.areaIds) {
            const landNode = graph.nodeById(landAreaId)
            if (!landNode || landNode.type !== IndonesiaAreaType.Land) {
                continue
            }

            for (const seaAreaId of landNode.neighbors[IndonesiaNeighborDirection.Sea]) {
                const seaNode = graph.nodeById(seaAreaId)
                if (!seaNode || seaNode.type !== IndonesiaAreaType.Sea) {
                    continue
                }
                seaAreaIds.add(seaAreaId)
            }
        }

        return [...seaAreaIds].sort((left, right) =>
            left.localeCompare(right, undefined, { numeric: true })
        )
    }
}
