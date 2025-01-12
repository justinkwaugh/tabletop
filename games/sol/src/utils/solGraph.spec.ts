import { Direction, SolGraph } from './solGraph.js'
import { expect, test } from 'vitest'

test('test', () => {
    const graph = new SolGraph(4)
    expect(graph.neighborsOf({ col: 0, row: 0 }, Direction.Clockwise)).toEqual([])
})
