import { describe, expect, it } from 'vitest'
import { IndonesiaGraph } from './indonesiaGraph.js'
import { INDONESIA_NODE_IDS, INDONESIA_NODES, IndonesiaNeighborDirection } from './indonesiaNodes.js'

function sorted(values: string[]): string[] {
    return [...values].sort((left, right) => left.localeCompare(right))
}

describe('IndonesiaGraph', () => {
    it('contains all land and sea nodes', () => {
        const graph = new IndonesiaGraph()
        expect(graph.size).toBe(INDONESIA_NODE_IDS.length)
        for (const nodeId of INDONESIA_NODE_IDS) {
            expect(graph.nodeById(nodeId)).toBeDefined()
        }
    })

    it('stores existing adjacency in the Land direction', () => {
        const graph = new IndonesiaGraph()
        for (const node of INDONESIA_NODES) {
            const graphNode = graph.nodeById(node.id)
            expect(graphNode).toBeDefined()
            if (!graphNode) {
                continue
            }

            const expectedLandNeighbors = sorted(node.neighbors[IndonesiaNeighborDirection.Land])
            const actualLandNeighbors = sorted(
                graph
                    .neighborsOf(graphNode, IndonesiaNeighborDirection.Land)
                    .map((neighbor) => neighbor.id.toString())
            )
            expect(actualLandNeighbors).toEqual(expectedLandNeighbors)
        }
    })

    it('starts with no Sea-direction neighbors', () => {
        const graph = new IndonesiaGraph()
        for (const node of graph) {
            expect(graph.neighborsOf(node, IndonesiaNeighborDirection.Sea)).toHaveLength(0)
        }
    })
})
