import { BaseGraph, type Direction } from '@tabletop/common'
import { INDONESIA_NODES, type IndonesiaNode, type IndonesiaNodeId } from './indonesiaNodes.js'

export class IndonesiaGraph extends BaseGraph<IndonesiaNode> {
    constructor() {
        super()
        this.initializeNodes()
    }

    private initializeNodes() {
        for (const node of INDONESIA_NODES) {
            this.setNode({ ...node, neighbors: [...node.neighbors] })
        }
    }

    public nodeById(id: IndonesiaNodeId): IndonesiaNode | undefined {
        return this.node(id)
    }

    public override neighborsOf(node: IndonesiaNode, _direction?: Direction): IndonesiaNode[] {
        return node.neighbors
            .map((neighborId) => this.node(neighborId))
            .filter((neighbor): neighbor is IndonesiaNode => neighbor !== undefined)
    }
}
