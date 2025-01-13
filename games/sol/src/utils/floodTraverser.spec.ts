import { ONE_TO_FOUR_PLAYER_RING_COUNTS, Ring, SolGraph, SolNode } from './solGraph.js'
import { describe, expect, it } from 'vitest'
import { flood } from './floodTraverser.js'

describe('Flood Traverser Tests', () => {
    it('should by default traverse all nodes', () => {
        const graph = new SolGraph(4)
        const traverser = flood({ start: graph.nodeAt({ row: Ring.Radiative, col: 0 }) })
        expect(Array.from(graph.traverse(traverser)).length).toEqual(graph.nodeCount())
    })

    it('should respect the range', () => {
        const graph = new SolGraph(4)
        const start = graph.nodeAt({ row: Ring.Center, col: 0 })
        const zeroTraverser = flood({ start, range: 0 })
        const range0Count = ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Center]
        expect(Array.from(graph.traverse(zeroTraverser)).length).toEqual(range0Count)

        const oneTraverser = flood({ start, range: 1 })
        const range1Count = range0Count + ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Core]
        expect(Array.from(graph.traverse(oneTraverser)).length).toEqual(range1Count)

        const twoTraverser = flood({ start, range: 2 })
        const range2Count = range1Count + ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Radiative]
        expect(Array.from(graph.traverse(twoTraverser)).length).toEqual(range2Count)

        const threeTraverser = flood({ start, range: 3 })
        const range3Count = range2Count + ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Convective]
        expect(Array.from(graph.traverse(threeTraverser)).length).toEqual(range3Count)
    })

    it('should be blocked by rings', () => {
        const graph = new SolGraph(4)

        const coreTraverser = flood({
            start: graph.nodeAt({ row: Ring.Core, col: 0 }),
            canTraverse: SolTraverseChecker
        })
        expect(Array.from(graph.traverse(coreTraverser)).length).toEqual(
            ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Core]
        )

        const radiativeTraverser = flood({
            start: graph.nodeAt({ row: Ring.Radiative, col: 0 }),
            canTraverse: SolTraverseChecker
        })
        expect(Array.from(graph.traverse(radiativeTraverser)).length).toEqual(
            ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Radiative]
        )

        const convectiveTraverser = flood({
            start: graph.nodeAt({ row: Ring.Convective, col: 0 }),
            canTraverse: SolTraverseChecker
        })
        expect(Array.from(graph.traverse(convectiveTraverser)).length).toEqual(
            ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Convective]
        )

        const outerTraverser = flood({
            start: graph.nodeAt({ row: Ring.Outer, col: 0 }),
            canTraverse: SolTraverseChecker
        })
        expect(Array.from(graph.traverse(outerTraverser)).length).toEqual(
            ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Outer] + ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Inner]
        )
    })
})

function SolTraverseChecker(from: SolNode, to: SolNode): boolean {
    if (from.coords.row === to.coords.row) {
        return true
    }
    if (from.coords.row === Ring.Outer && to.coords.row === Ring.Inner) {
        return true
    }
    if (from.coords.row === Ring.Inner && to.coords.row === Ring.Outer) {
        return true
    }
    return false
}
