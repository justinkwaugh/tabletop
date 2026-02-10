import {
    busGraph,
    BUS_BUILDING_SITES,
    BUS_BUILDING_SITE_IDS,
    BUS_BUILDING_SITE_IDS_BY_NODE,
    BUS_NODE_IDS,
    BUS_STATION_IDS,
    type BusNodeId
} from './busGraph.js'
import { describe, expect, it } from 'vitest'

describe('BusGraph', () => {
    function hasEdge(from: BusNodeId, to: BusNodeId): boolean {
        const fromNode = busGraph.nodeById(from)
        if (!fromNode) {
            return false
        }

        return busGraph.neighborsOf(fromNode).some((neighbor) => neighbor.id === to)
    }

    it('contains exactly 36 nodes', () => {
        expect(busGraph.size).toBe(36)
    })

    it('marks both station intersections', () => {
        const stations = busGraph.stationNodes()
        expect(stations).toHaveLength(2)
        expect(stations.every((node) => node.isStation)).toBe(true)
    })

    it('is fully connected', () => {
        const nodes = Array.from(busGraph)
        const start = nodes[0]
        expect(start).toBeDefined()
        if (!start) {
            return
        }

        const visited = new Set([start.id])
        const queue = [start]

        while (queue.length > 0) {
            const node = queue.shift()!
            for (const neighbor of busGraph.neighborsOf(node)) {
                if (visited.has(neighbor.id)) {
                    continue
                }
                visited.add(neighbor.id)
                queue.push(neighbor)
            }
        }

        expect(visited.size).toBe(busGraph.size)
    })

    it('has bidirectional links', () => {
        for (const node of busGraph) {
            for (const neighbor of busGraph.neighborsOf(node)) {
                expect(busGraph.neighborsOf(neighbor).some((candidate) => candidate.id === node.id)).toBe(
                    true
                )
            }
        }
    })

    it('includes known road links from board validation', () => {
        expect(hasEdge('N02', 'N08')).toBe(true)
        expect(hasEdge('N24', 'N20')).toBe(true)
        expect(hasEdge('N22', 'N35')).toBe(true)
    })

    it('keeps node N22 connected to the expected roads', () => {
        const center = busGraph.nodeById('N22')
        expect(center).toBeDefined()
        if (!center) {
            return
        }

        const neighborIds = busGraph
            .neighborsOf(center)
            .map((neighbor) => neighbor.id)
            .sort()

        expect(neighborIds).toEqual(['N21', 'N24', 'N28', 'N30', 'N33', 'N35'].sort())
    })

    it('has all 47 building sites with expected value distribution', () => {
        expect(BUS_BUILDING_SITE_IDS).toHaveLength(47)

        const valueCounts = { 1: 0, 2: 0, 3: 0, 4: 0 }
        for (const site of Object.values(BUS_BUILDING_SITES)) {
            valueCounts[site.value] += 1
        }

        expect(valueCounts).toEqual({ 1: 12, 2: 11, 3: 9, 4: 15 })
    })

    it('attaches building site ids to nodes (stations none, others one or two)', () => {
        const stationSet = new Set(BUS_STATION_IDS)

        for (const nodeId of BUS_NODE_IDS) {
            const node = busGraph.nodeById(nodeId)
            expect(node).toBeDefined()
            if (!node) {
                continue
            }

            expect(node.buildingSiteIds).toEqual(BUS_BUILDING_SITE_IDS_BY_NODE[nodeId])

            if (stationSet.has(nodeId)) {
                expect(node.buildingSiteIds).toHaveLength(0)
            } else {
                expect(node.buildingSiteIds.length).toBeGreaterThanOrEqual(1)
                expect(node.buildingSiteIds.length).toBeLessThanOrEqual(2)
            }
        }
    })
})
