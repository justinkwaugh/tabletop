import { Direction, SolGraph } from './solGraph.js'

describe('test', () => {
    it('tests things', () => {
        const graph = new SolGraph(4)
        expect(graph.neighborsOf({ col: 0, row: 0 }, Direction.Clockwise)).toEqual([])
    })
})
