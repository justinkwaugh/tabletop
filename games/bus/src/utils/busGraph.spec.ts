import {
    BuildingSites,
    BUS_BUILDING_SITE_IDS,
    BUS_BUILDING_SITE_IDS_BY_NODE,
    BUS_NODE_IDS,
    BUS_STATION_IDS,
    BusGraph,
    type BusNodeId
} from './busGraph.js'
import { describe, expect, it } from 'vitest'

describe('BusGraph', () => {
    it('contains exactly 36 nodes', () => {
        const busGraph = new BusGraph()
        expect(busGraph.size).toBe(36)
    })

    it('marks both station intersections', () => {
        const busGraph = new BusGraph()
        const stations = busGraph.stationNodes()
        expect(stations).toHaveLength(2)
        expect(stations.every((node) => node.isStation)).toBe(true)
    })

    it('is fully connected', () => {
        const busGraph = new BusGraph()
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
        const busGraph = new BusGraph()
        for (const node of busGraph) {
            for (const neighbor of busGraph.neighborsOf(node)) {
                expect(
                    busGraph.neighborsOf(neighbor).some((candidate) => candidate.id === node.id)
                ).toBe(true)
            }
        }
    })

    it('has all 47 building sites with expected value distribution', () => {
        expect(BUS_BUILDING_SITE_IDS).toHaveLength(47)

        const valueCounts = { 1: 0, 2: 0, 3: 0, 4: 0 }
        for (const site of Object.values(BuildingSites)) {
            valueCounts[site.value] += 1
        }

        expect(valueCounts).toEqual({ 1: 12, 2: 11, 3: 9, 4: 15 })
    })

    it('attaches building site ids to nodes (stations none, others one or two)', () => {
        const busGraph = new BusGraph()
        const stationSet = new Set<BusNodeId>(BUS_STATION_IDS)

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
