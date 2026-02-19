import { BaseGraph, type Direction } from '@tabletop/common'
import { INDONESIA_NODES, type IndonesiaNode, type IndonesiaNodeId } from './indonesiaNodes.js'

export class IndonesiaGraph extends BaseGraph<IndonesiaNode> {
    constructor() {
        super()
        this.initializeNodes()
    }

    private initializeNodes() {
        for (const node of INDONESIA_NODES) {
            this.setNode({ ...node })
        }
    }

    public nodeById(id: IndonesiaNodeId): IndonesiaNode | undefined {
        return this.node(id)
    }

    public override neighborsOf(_node: IndonesiaNode, _direction?: Direction): IndonesiaNode[] {
        return []
    }
}
