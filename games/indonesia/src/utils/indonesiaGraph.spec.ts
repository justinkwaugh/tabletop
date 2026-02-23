import { describe, expect, it } from 'vitest'
import { IndonesiaGraph } from './indonesiaGraph.js'
import {
    INDONESIA_NODE_IDS,
    INDONESIA_NODES,
    IndonesiaAreaType,
    IndonesiaNeighborDirection
} from './indonesiaNodes.js'

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

    it('includes configured S14 sea and land direction neighbors', () => {
        const graph = new IndonesiaGraph()
        const s14 = graph.nodeById('S14')
        expect(s14).toBeDefined()
        expect(
            sorted(
                graph
                    .neighborsOf(s14!, IndonesiaNeighborDirection.Sea)
                    .map((neighbor) => neighbor.id.toString())
            )
        ).toEqual(['S05', 'S06', 'S09'])
        expect(
            sorted(
                graph
                    .neighborsOf(s14!, IndonesiaNeighborDirection.Land)
                    .map((neighbor) => neighbor.id.toString())
            )
        ).toEqual(['A01', 'A02', 'A03', 'A04', 'A08'])

        expect(
            sorted(
                graph
                    .neighborsOf(graph.nodeById('A01')!, IndonesiaNeighborDirection.Sea)
                    .map((neighbor) => neighbor.id.toString())
            )
        ).toEqual(['S14'])

        const expectedS01SeaNeighbors = sorted(
            INDONESIA_NODES.find((node) => node.id === 'S01')!.neighbors[IndonesiaNeighborDirection.Sea]
        )
        expect(
            sorted(
                graph
                    .neighborsOf(graph.nodeById('S01')!, IndonesiaNeighborDirection.Sea)
                    .map((neighbor) => neighbor.id.toString())
            )
        ).toEqual(expectedS01SeaNeighbors)
    })

    it('keeps all directed edges reciprocal', () => {
        const graph = new IndonesiaGraph()
        for (const node of INDONESIA_NODES) {
            const graphNode = graph.nodeById(node.id)
            expect(graphNode).toBeDefined()
            if (!graphNode) {
                continue
            }

            for (const direction of Object.values(IndonesiaNeighborDirection)) {
                for (const neighborId of graphNode.neighbors[direction]) {
                    const neighbor = graph.nodeById(neighborId)
                    expect(neighbor).toBeDefined()
                    if (!neighbor) {
                        continue
                    }

                    const reciprocalDirection =
                        graphNode.type === IndonesiaAreaType.Sea
                            ? IndonesiaNeighborDirection.Sea
                            : IndonesiaNeighborDirection.Land

                    expect(neighbor.neighbors[reciprocalDirection]).toContain(graphNode.id)
                }
            }
        }
    })
})
