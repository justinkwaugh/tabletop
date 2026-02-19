import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Hydratable } from '@tabletop/common'
import { IndonesiaGraph } from '../utils/indonesiaGraph.js'
import type { IndonesiaNode } from '../utils/indonesiaNodes.js'

export type IndonesiaBoard = Type.Static<typeof IndonesiaBoard>
export const IndonesiaBoard = Type.Object({})

const IndonesiaBoardValidator = Compile(IndonesiaBoard)

export class HydratedIndonesiaBoard
    extends Hydratable<typeof IndonesiaBoard>
    implements IndonesiaBoard, Iterable<IndonesiaNode>
{
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
}
