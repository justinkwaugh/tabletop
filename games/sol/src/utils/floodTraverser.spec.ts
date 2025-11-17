import { ONE_TO_FOUR_PLAYER_RING_COUNTS, Ring, SolGraph } from './solGraph.js'
import { describe, expect, it } from 'vitest'
import { breadthFirst } from '@tabletop/common'

describe('Flood Traverser Tests', () => {
    it('should by default traverse all nodes', () => {
        const graph = new SolGraph(4)
        const startNode = graph.nodeAt({ row: Ring.Radiative, col: 0 })
        expect(startNode).toBeDefined()
        const traverser = breadthFirst({ start: startNode! })
        expect(Array.from(graph.traverse(traverser)).length).toEqual(graph.size())
    })

    it('should respect the range', () => {
        const graph = new SolGraph(4)
        const start = graph.nodeAt({ row: Ring.Center, col: 0 })
        expect(start).toBeDefined()
        const zeroTraverser = breadthFirst({ start: start!, range: 0 })
        const range0Count = ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Center]
        expect(Array.from(graph.traverse(zeroTraverser)).length).toEqual(range0Count)

        const oneTraverser = breadthFirst({ start: start!, range: 1 })
        const range1Count = range0Count + ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Core]
        expect(Array.from(graph.traverse(oneTraverser)).length).toEqual(range1Count)

        const twoTraverser = breadthFirst({ start: start!, range: 2 })
        const range2Count = range1Count + ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Radiative]
        expect(Array.from(graph.traverse(twoTraverser)).length).toEqual(range2Count)

        const threeTraverser = breadthFirst({ start: start!, range: 3 })
        const range3Count = range2Count + ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Convective]
        expect(Array.from(graph.traverse(threeTraverser)).length).toEqual(range3Count)
    })
})
