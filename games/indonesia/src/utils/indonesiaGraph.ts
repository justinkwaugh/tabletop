import { BaseGraph, type Direction } from '@tabletop/common'
import {
    INDONESIA_NODES,
    IndonesiaNeighborDirection,
    type IndonesiaNode,
    type IndonesiaNodeId
} from './indonesiaNodes.js'

export class IndonesiaGraph extends BaseGraph<IndonesiaNode> {
    constructor() {
        super()
        this.initializeNodes()
    }

    private initializeNodes() {
        for (const node of INDONESIA_NODES) {
            this.setNode({
                ...node,
                neighbors: {
                    [IndonesiaNeighborDirection.Land]: [
                        ...node.neighbors[IndonesiaNeighborDirection.Land]
                    ],
                    [IndonesiaNeighborDirection.Sea]: [
                        ...node.neighbors[IndonesiaNeighborDirection.Sea]
                    ]
                }
            })
        }
    }

    public nodeById(id: IndonesiaNodeId): IndonesiaNode | undefined {
        return this.node(id)
    }

    private neighborsByDirection(node: IndonesiaNode, direction: Direction): IndonesiaNodeId[] {
        if (direction === IndonesiaNeighborDirection.Land) {
            return node.neighbors[IndonesiaNeighborDirection.Land]
        }
        if (direction === IndonesiaNeighborDirection.Sea) {
            return node.neighbors[IndonesiaNeighborDirection.Sea]
        }
        return []
    }

    public override neighborsOf(node: IndonesiaNode, direction?: Direction): IndonesiaNode[] {
        const directedNeighborIds = direction
            ? this.neighborsByDirection(node, direction)
            : [
                  ...node.neighbors[IndonesiaNeighborDirection.Land],
                  ...node.neighbors[IndonesiaNeighborDirection.Sea]
              ]

        const uniqueNeighborIds = [...new Set(directedNeighborIds)]

        return uniqueNeighborIds
            .map((neighborId) => this.node(neighborId))
            .filter((neighbor): neighbor is IndonesiaNode => neighbor !== undefined)
    }
}
