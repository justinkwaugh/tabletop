import { CardinalDirection, sameCoordinates } from '@tabletop/common'
import { Cell, CellType, isStallCell } from '../components/cells.js'
import { describe, expect, it } from 'vitest'
import { GoodsType } from '../definition/goodsType.js'
import { FreshFishGraph } from './freshFishGraph.js'

describe('Fresh Fish Graph Tests', () => {
    it('iterates the entire graph', () => {
        const cells: Cell[][] = [
            [{ type: CellType.OffBoard }, { type: CellType.Empty }, { type: CellType.Market }],
            [
                { type: CellType.Truck, goodsType: GoodsType.Fish },
                { type: CellType.Disk, playerId: 'abc' },
                { type: CellType.Empty }
            ],
            [{ type: CellType.OffBoard }, { type: CellType.Empty }, { type: CellType.Empty }]
        ]

        const graph = new FreshFishGraph(cells)

        expect(graph.size).toEqual(7)

        const nodes = []
        for (const node of graph) {
            nodes.push(node)
        }

        expect(nodes.length).toEqual(7)

        const nodes2 = Array.from(Iterator.from(graph).map((node) => node))
        expect(nodes2.length).toEqual(7)
    })

    it('correctly assigns neighbors', () => {
        const cells: Cell[][] = [
            [{ type: CellType.OffBoard }, { type: CellType.Empty }, { type: CellType.Market }],
            [
                { type: CellType.Truck, goodsType: GoodsType.Fish },
                { type: CellType.Disk, playerId: 'abc' },
                { type: CellType.Empty }
            ],
            [{ type: CellType.OffBoard }, { type: CellType.Empty }, { type: CellType.Empty }]
        ]

        const graph = new FreshFishGraph(cells)
        const leftCenterNode = graph.nodeAt({ row: 1, col: 0 })
        expect(leftCenterNode).toBeDefined()

        if (!leftCenterNode) {
            throw new Error('Left center node is undefined')
        }

        // const northNeighbor = leftCenterNode.neighbors[CardinalDirection.North]
        // expect(northNeighbor).toBeUndefined()

        // const southNeighbor = leftCenterNode.neighbors[CardinalDirection.South]
        // expect(southNeighbor).toBeUndefined()

        // const eastNeighbor = leftCenterNode.neighbors[CardinalDirection.East]
        // expect(eastNeighbor).toEqual({ row: 1, col: 1 })

        // const westNeighbor = leftCenterNode.neighbors[CardinalDirection.West]
        // expect(westNeighbor).toBeUndefined()
    })

    it('has correct dimensions', () => {
        const cells: Cell[][] = [
            [{ type: CellType.OffBoard }, { type: CellType.Empty }],
            [
                { type: CellType.Truck, goodsType: GoodsType.Fish },
                { type: CellType.Disk, playerId: 'abc' },
                { type: CellType.Empty }
            ],
            [{ type: CellType.OffBoard }, { type: CellType.Empty }]
        ]

        const graph = new FreshFishGraph(cells)

        expect(graph.minMaxCoords.minX?.col).toEqual(0)
        expect(graph.minMaxCoords.maxY?.row).toEqual(2)
        expect(graph.minMaxCoords.minY?.row).toEqual(0)
        expect(graph.minMaxCoords.maxX?.col).toEqual(2)

        const dimensions = graph.coordinateDimensions()
        expect(dimensions.rows).toEqual(3)
        expect(dimensions.cols).toEqual(3)
    })
})
