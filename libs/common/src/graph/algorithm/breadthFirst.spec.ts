import { describe, expect, it } from 'vitest'
import { RectilinearGrid } from '../grids/rectilinear.js'
import { coordinatesToNumber, OffsetCoordinates } from '../coordinates.js'
import { rectanglePattern } from '../patterns/rectangle.js'
import { breadthFirstAlgorithm } from './breadthFirst.js'
import { patternGenerator } from '../generators/pattern.js'

function createTestNode(coords: OffsetCoordinates) {
    return { id: coordinatesToNumber(coords), coords }
}

describe('Breadth First Algorithm Tests', () => {
    it('Traverses entire graph', () => {
        const graph = new RectilinearGrid()
        const nodeGenerator = patternGenerator(
            rectanglePattern({ start: { row: -2, col: -2 }, width: 5, height: 5 }),
            createTestNode
        )
        graph.populate(nodeGenerator)

        const startNode = graph.nodeAt({ row: 0, col: 0 })
        if (!startNode) {
            throw new Error('Start node not found')
        }
        const nodes = Array.from(breadthFirstAlgorithm({ start: startNode }, graph))

        expect(nodes.length).toEqual(25)
    })

    it('Respects range limit', () => {
        const graph = new RectilinearGrid()
        const nodeGenerator = patternGenerator(
            rectanglePattern({ start: { row: -2, col: -2 }, width: 5, height: 5 }),
            createTestNode
        )
        graph.populate(nodeGenerator)
        const startNode = graph.nodeAt({ row: 0, col: 0 })
        if (!startNode) {
            throw new Error('Start node not found')
        }
        const nodes = Array.from(breadthFirstAlgorithm({ start: startNode, range: 1 }, graph))
        expect(nodes.length).toEqual(9)
    })

    it('Respects canTraverse', () => {
        const graph = new RectilinearGrid()
        const nodeGenerator = patternGenerator(
            rectanglePattern({ start: { row: -2, col: -2 }, width: 5, height: 5 }),
            createTestNode
        )
        graph.populate(nodeGenerator)
        const startNode = graph.nodeAt({ row: 0, col: 0 })
        if (!startNode) {
            throw new Error('Start node not found')
        }
        const nodes = Array.from(
            breadthFirstAlgorithm(
                {
                    start: startNode,
                    canTraverse: (from, to) => {
                        return to.coords.row >= from.coords.row
                    }
                },
                graph
            )
        )
        expect(nodes.length).toEqual(15)
    })
})
