import { BaseGraph, type Direction, type GraphNode } from '@tabletop/common'

export const BUS_NODE_IDS = [
    'N01',
    'N02',
    'N03',
    'N04',
    'N05',
    'N06',
    'N07',
    'N08',
    'N09',
    'N10',
    'N11',
    'N12',
    'N13',
    'N14',
    'N15',
    'N16',
    'N17',
    'N18',
    'N19',
    'N20',
    'N21',
    'N22',
    'N23',
    'N24',
    'N25',
    'N26',
    'N27',
    'N28',
    'N29',
    'N30',
    'N31',
    'N32',
    'N33',
    'N34',
    'N35',
    'N36'
] as const

export type BusNodeId = (typeof BUS_NODE_IDS)[number]

export const BUS_STATION_IDS = ['N08', 'N28'] as const satisfies readonly BusNodeId[]
export type BusStationId = (typeof BUS_STATION_IDS)[number]

export type BuildingSiteValue = 1 | 2 | 3 | 4

export type BuildingSite = {
    id: string
    nodeId: BusNodeId
    value: BuildingSiteValue
}

export const BUS_BUILDING_SITES = {
    B01: {
        id: 'B01',
        nodeId: 'N01',
        value: 4
    },
    B02: {
        id: 'B02',
        nodeId: 'N02',
        value: 4
    },
    B03: {
        id: 'B03',
        nodeId: 'N03',
        value: 4
    },
    B04: {
        id: 'B04',
        nodeId: 'N04',
        value: 2
    },
    B05: {
        id: 'B05',
        nodeId: 'N05',
        value: 3
    },
    B06: {
        id: 'B06',
        nodeId: 'N05',
        value: 2
    },
    B07: {
        id: 'B07',
        nodeId: 'N06',
        value: 4
    },
    B08: {
        id: 'B08',
        nodeId: 'N07',
        value: 2
    },
    B09: {
        id: 'B09',
        nodeId: 'N07',
        value: 3
    },
    B10: {
        id: 'B10',
        nodeId: 'N09',
        value: 2
    },
    B11: {
        id: 'B11',
        nodeId: 'N10',
        value: 1
    },
    B12: {
        id: 'B12',
        nodeId: 'N10',
        value: 3
    },
    B13: {
        id: 'B13',
        nodeId: 'N11',
        value: 4
    },
    B14: {
        id: 'B14',
        nodeId: 'N12',
        value: 4
    },
    B15: {
        id: 'B15',
        nodeId: 'N13',
        value: 2
    },
    B16: {
        id: 'B16',
        nodeId: 'N14',
        value: 1
    },
    B17: {
        id: 'B17',
        nodeId: 'N14',
        value: 1
    },
    B18: {
        id: 'B18',
        nodeId: 'N15',
        value: 1
    },
    B19: {
        id: 'B19',
        nodeId: 'N15',
        value: 3
    },
    B20: {
        id: 'B20',
        nodeId: 'N16',
        value: 4
    },
    B21: {
        id: 'B21',
        nodeId: 'N17',
        value: 1
    },
    B22: {
        id: 'B22',
        nodeId: 'N17',
        value: 1
    },
    B23: {
        id: 'B23',
        nodeId: 'N18',
        value: 2
    },
    B24: {
        id: 'B24',
        nodeId: 'N19',
        value: 1
    },
    B25: {
        id: 'B25',
        nodeId: 'N19',
        value: 1
    },
    B26: {
        id: 'B26',
        nodeId: 'N20',
        value: 3
    },
    B27: {
        id: 'B27',
        nodeId: 'N20',
        value: 2
    },
    B28: {
        id: 'B28',
        nodeId: 'N21',
        value: 1
    },
    B29: {
        id: 'B29',
        nodeId: 'N21',
        value: 3
    },
    B30: {
        id: 'B30',
        nodeId: 'N22',
        value: 3
    },
    B31: {
        id: 'B31',
        nodeId: 'N22',
        value: 1
    },
    B32: {
        id: 'B32',
        nodeId: 'N23',
        value: 4
    },
    B33: {
        id: 'B33',
        nodeId: 'N24',
        value: 1
    },
    B34: {
        id: 'B34',
        nodeId: 'N24',
        value: 1
    },
    B35: {
        id: 'B35',
        nodeId: 'N25',
        value: 4
    },
    B36: {
        id: 'B36',
        nodeId: 'N26',
        value: 2
    },
    B37: {
        id: 'B37',
        nodeId: 'N27',
        value: 4
    },
    B38: {
        id: 'B38',
        nodeId: 'N29',
        value: 4
    },
    B39: {
        id: 'B39',
        nodeId: 'N30',
        value: 3
    },
    B40: {
        id: 'B40',
        nodeId: 'N30',
        value: 2
    },
    B41: {
        id: 'B41',
        nodeId: 'N31',
        value: 4
    },
    B42: {
        id: 'B42',
        nodeId: 'N32',
        value: 2
    },
    B43: {
        id: 'B43',
        nodeId: 'N33',
        value: 3
    },
    B44: {
        id: 'B44',
        nodeId: 'N33',
        value: 2
    },
    B45: {
        id: 'B45',
        nodeId: 'N34',
        value: 4
    },
    B46: {
        id: 'B46',
        nodeId: 'N35',
        value: 4
    },
    B47: {
        id: 'B47',
        nodeId: 'N36',
        value: 4
    }
} as const satisfies Record<string, BuildingSite>

export type BuildingSiteId = keyof typeof BUS_BUILDING_SITES

export const BUS_BUILDING_SITE_IDS = Object.keys(BUS_BUILDING_SITES) as BuildingSiteId[]

export const BUS_BUILDING_SITE_IDS_BY_NODE = (() => {
    const siteIdsByNode = Object.fromEntries(
        BUS_NODE_IDS.map((nodeId) => [nodeId, [] as BuildingSiteId[]])
    ) as Record<BusNodeId, BuildingSiteId[]>

    for (const siteId of BUS_BUILDING_SITE_IDS) {
        const site = BUS_BUILDING_SITES[siteId]
        siteIdsByNode[site.nodeId].push(siteId)
    }

    for (const nodeId of BUS_NODE_IDS) {
        siteIdsByNode[nodeId].sort()
    }

    return siteIdsByNode
})()
;(() => {
    const expectedValueCounts: Record<BuildingSiteValue, number> = {
        1: 12,
        2: 11,
        3: 9,
        4: 15
    }

    const valueCounts: Record<BuildingSiteValue, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0
    }

    for (const siteId of BUS_BUILDING_SITE_IDS) {
        const site = BUS_BUILDING_SITES[siteId]

        if (site.id !== siteId) {
            throw new Error(`Site id mismatch: expected ${siteId}, found ${site.id}`)
        }

        valueCounts[site.value] += 1
    }

    for (const value of [1, 2, 3, 4] as const) {
        if (valueCounts[value] !== expectedValueCounts[value]) {
            throw new Error(
                `Expected ${expectedValueCounts[value]} value-${value} sites, found ${valueCounts[value]}`
            )
        }
    }

    const stationIdSet = new Set<BusNodeId>(BUS_STATION_IDS)

    for (const nodeId of BUS_NODE_IDS) {
        const siteCount = BUS_BUILDING_SITE_IDS_BY_NODE[nodeId].length

        if (stationIdSet.has(nodeId)) {
            if (siteCount !== 0) {
                throw new Error(`Station node ${nodeId} should not have building sites`)
            }
            continue
        }

        if (siteCount < 1 || siteCount > 2) {
            throw new Error(
                `Node ${nodeId} should have exactly one or two building sites, found ${siteCount}`
            )
        }
    }
})()

export const BUS_EDGE_IDS = [
    ['N22', 'N21'],
    ['N22', 'N24'],
    ['N22', 'N30'],
    ['N22', 'N33'],
    ['N22', 'N35'],
    ['N22', 'N28'],
    ['N01', 'N03'],
    ['N01', 'N05'],
    ['N01', 'N07'],
    ['N01', 'N09'],
    ['N02', 'N04'],
    ['N02', 'N05'],
    ['N02', 'N08'],
    ['N03', 'N06'],
    ['N03', 'N12'],
    ['N04', 'N11'],
    ['N04', 'N08'],
    ['N05', 'N09'],
    ['N05', 'N10'],
    ['N05', 'N08'],
    ['N06', 'N07'],
    ['N06', 'N12'],
    ['N07', 'N09'],
    ['N07', 'N13'],
    ['N09', 'N14'],
    ['N10', 'N14'],
    ['N10', 'N15'],
    ['N10', 'N08'],
    ['N11', 'N08'],
    ['N12', 'N13'],
    ['N12', 'N18'],
    ['N13', 'N14'],
    ['N13', 'N18'],
    ['N13', 'N19'],
    ['N14', 'N17'],
    ['N14', 'N19'],
    ['N15', 'N16'],
    ['N15', 'N17'],
    ['N15', 'N20'],
    ['N15', 'N23'],
    ['N15', 'N08'],
    ['N16', 'N23'],
    ['N16', 'N08'],
    ['N17', 'N24'],
    ['N18', 'N21'],
    ['N18', 'N25'],
    ['N19', 'N21'],
    ['N19', 'N24'],
    ['N20', 'N23'],
    ['N20', 'N24'],
    ['N20', 'N26'],
    ['N21', 'N28'],
    ['N23', 'N27'],
    ['N24', 'N30'],
    ['N24', 'N31'],
    ['N25', 'N29'],
    ['N25', 'N28'],
    ['N26', 'N27'],
    ['N26', 'N31'],
    ['N27', 'N34'],
    ['N29', 'N28'],
    ['N30', 'N35'],
    ['N31', 'N34'],
    ['N31', 'N35'],
    ['N32', 'N36'],
    ['N32', 'N28'],
    ['N33', 'N35'],
    ['N33', 'N36'],
    ['N33', 'N28'],
    ['N36', 'N28']
] as const satisfies readonly (readonly [BusNodeId, BusNodeId])[]

export type BusNode = GraphNode & {
    id: BusNodeId
    isStation: boolean
    neighbors: BusNodeId[]
    buildingSiteIds: BuildingSiteId[]
}

const stationIdSet = new Set<BusNodeId>(BUS_STATION_IDS)

export class BusGraph extends BaseGraph<BusNode> {
    constructor() {
        super()
        this.initializeNodes()
        this.initializeEdges()
    }

    private initializeNodes() {
        for (const id of BUS_NODE_IDS) {
            this.setNode({
                id,
                isStation: stationIdSet.has(id),
                neighbors: [],
                buildingSiteIds: [...BUS_BUILDING_SITE_IDS_BY_NODE[id]]
            })
        }
    }

    private initializeEdges() {
        for (const [sourceId, targetId] of BUS_EDGE_IDS) {
            this.connect(sourceId, targetId)
        }
    }

    private connect(sourceId: BusNodeId, targetId: BusNodeId) {
        const sourceNode = this.node(sourceId)
        const targetNode = this.node(targetId)
        if (!sourceNode || !targetNode) {
            return
        }

        if (!sourceNode.neighbors.includes(targetId)) {
            sourceNode.neighbors.push(targetId)
        }
        if (!targetNode.neighbors.includes(sourceId)) {
            targetNode.neighbors.push(sourceId)
        }
    }

    public nodeById(id: BusNodeId): BusNode | undefined {
        return this.node(id)
    }

    public stationNodes(): BusNode[] {
        return BUS_STATION_IDS.map((id) => this.nodeById(id)).filter(
            (node): node is BusNode => node !== undefined
        )
    }

    public override neighborsOf(node: BusNode, _direction?: Direction): BusNode[] {
        return node.neighbors
            .map((neighborId) => this.node(neighborId))
            .filter((neighbor): neighbor is BusNode => neighbor !== undefined)
    }
}

export const busGraph = new BusGraph()
