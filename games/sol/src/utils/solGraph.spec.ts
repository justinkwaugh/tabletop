import { sameCoordinates } from '@tabletop/common'
import {
    Direction,
    FIVE_PLAYER_RING_COUNTS,
    ONE_TO_FOUR_PLAYER_RING_COUNTS,
    Ring,
    SolGraph
} from './solGraph.js'
import { describe, expect, it } from 'vitest'

describe('Sol Graph Tests', () => {
    it('should have no clockwise or counter clockwise neighbors at the center', () => {
        const graph = new SolGraph(4)
        expect(graph.neighborsOf({ col: 0, row: 0 }, Direction.Clockwise)).toEqual([])
        expect(graph.neighborsOf({ col: 0, row: 0 }, Direction.CounterClockwise)).toEqual([])
    })

    it('can find neighbors in every direction', () => {
        const graph = new SolGraph(4)
        const neighbors = graph.neighborsOf({ row: Ring.Core, col: 0 })
        expect(neighbors.length).toEqual(5)
        const outNeighbors = graph.neighborsOf({ row: Ring.Core, col: 0 }, Direction.Out)
        expect(outNeighbors.length).toEqual(2)
        expect(
            sameCoordinates(outNeighbors[0].coords, { row: Ring.Radiative, col: 0 })
        ).toBeTruthy()
        expect(
            sameCoordinates(outNeighbors[1].coords, { row: Ring.Radiative, col: 1 })
        ).toBeTruthy()
        const inNeighbors = graph.neighborsOf({ row: Ring.Core, col: 0 }, Direction.In)
        expect(inNeighbors.length).toEqual(1)
        expect(sameCoordinates(inNeighbors[0].coords, { row: Ring.Center, col: 0 })).toBeTruthy()
        const ccwNeighbors = graph.neighborsOf(
            { row: Ring.Core, col: 0 },
            Direction.CounterClockwise
        )
        expect(ccwNeighbors.length).toEqual(1)
        expect(sameCoordinates(ccwNeighbors[0].coords, { row: Ring.Core, col: 4 })).toBeTruthy()
        const cwNeighbors = graph.neighborsOf({ row: Ring.Core, col: 0 }, Direction.Clockwise)
        expect(cwNeighbors.length).toEqual(1)
        expect(sameCoordinates(cwNeighbors[0].coords, { row: Ring.Core, col: 1 })).toBeTruthy()
    })

    it('iterates the entire graph', () => {
        const graph4p = new SolGraph(4)
        const nodes4p = []
        for (const node of graph4p) {
            nodes4p.push(node)
        }

        expect(nodes4p.length).toEqual(graph4p.nodeCount())

        const graph5p = new SolGraph(5)
        const nodes5p = []
        for (const node of graph5p) {
            nodes5p.push(node)
        }

        expect(nodes5p.length).toEqual(graph5p.nodeCount())
    })

    it('has the correct node count', () => {
        const graph = new SolGraph(4)
        expect(graph.nodeCount()).toEqual(
            ONE_TO_FOUR_PLAYER_RING_COUNTS.reduce((acc, count) => acc + count, 0)
        )

        const graph5p = new SolGraph(5)
        expect(graph5p.nodeCount()).toEqual(
            FIVE_PLAYER_RING_COUNTS.reduce((acc, count) => acc + count, 0)
        )
    })
})
