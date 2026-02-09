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
                neighbors: []
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
