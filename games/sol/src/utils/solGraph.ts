import { OffsetCoordinates } from '@tabletop/common'
import { BaseGraph, Graph, Node } from './graph.js'
import { flood } from './floodTraverser.js'

export enum Direction {
    Out = 'O',
    In = 'I',
    Clockwise = 'C',
    CounterClockwise = 'CC',
    Portal = 'P' // For Portal Effect to connect nodes
}

export enum Ring {
    Core = 0,
    Radiative = 1,
    Convective = 2,
    Inner = 3,
    Outer = 4
}

export type SolNode = Node<OffsetCoordinates> & {
    neighbors: Record<Direction, OffsetCoordinates[]>
}

export const ONE_TO_FOUR_PLAYER_RING_COUNTS = [5, 8, 13, 13, 13]
export const FIVE_PLAYER_RING_COUNTS = [5, 8, 13, 16, 16]

// prettier-ignore
const IN_OUT_EDGES = [
    // Radiative to Convective
    [{ col: 0, row: Ring.Radiative },{ col: 0, row: Ring.Convective }],
    [{ col: 0, row: Ring.Radiative },{ col: 1, row: Ring.Convective }],
    [{ col: 1, row: Ring.Radiative },{ col: 2, row: Ring.Convective }],
    [{ col: 1, row: Ring.Radiative },{ col: 3, row: Ring.Convective }],
    [{ col: 2, row: Ring.Radiative },{ col: 3, row: Ring.Convective }],
    [{ col: 2, row: Ring.Radiative },{ col: 4, row: Ring.Convective }],
    [{ col: 2, row: Ring.Radiative },{ col: 5, row: Ring.Convective }],
    [{ col: 3, row: Ring.Radiative },{ col: 5, row: Ring.Convective }],
    [{ col: 3, row: Ring.Radiative },{ col: 6, row: Ring.Convective }],
    [{ col: 4, row: Ring.Radiative },{ col: 6, row: Ring.Convective }],
    [{ col: 4, row: Ring.Radiative },{ col: 7, row: Ring.Convective }],
    [{ col: 4, row: Ring.Radiative },{ col: 8, row: Ring.Convective }],
    [{ col: 5, row: Ring.Radiative },{ col: 8, row: Ring.Convective }],
    [{ col: 5, row: Ring.Radiative },{ col: 9, row: Ring.Convective }],
    [{ col: 6, row: Ring.Radiative },{ col: 10, row: Ring.Convective }],
    [{ col: 6, row: Ring.Radiative },{ col: 11, row: Ring.Convective }],
    [{ col: 7, row: Ring.Radiative },{ col: 11, row: Ring.Convective }],
    [{ col: 7, row: Ring.Radiative },{ col: 12, row: Ring.Convective }],
    [{ col: 7, row: Ring.Radiative },{ col: 0, row: Ring.Convective }],
    // Core to Radiative
    [{ col: 0, row: Ring.Core },{ col: 0, row: Ring.Radiative }],
    [{ col: 0, row: Ring.Core },{ col: 1, row: Ring.Radiative }],
    [{ col: 1, row: Ring.Core },{ col: 2, row: Ring.Radiative }],
    [{ col: 1, row: Ring.Core },{ col: 3, row: Ring.Radiative }],
    [{ col: 2, row: Ring.Core },{ col: 3, row: Ring.Radiative }],
    [{ col: 2, row: Ring.Core },{ col: 4, row: Ring.Radiative }],
    [{ col: 3, row: Ring.Core },{ col: 5, row: Ring.Radiative }],
    [{ col: 3, row: Ring.Core },{ col: 6, row: Ring.Radiative }],
    [{ col: 4, row: Ring.Core },{ col: 6, row: Ring.Radiative }],
    [{ col: 4, row: Ring.Core },{ col: 7, row: Ring.Radiative }],
    [{ col: 4, row: Ring.Core },{ col: 0, row: Ring.Radiative }]
]

export class SolGraph
    extends BaseGraph<SolNode, OffsetCoordinates>
    implements Graph<SolNode, OffsetCoordinates>, Iterable<SolNode>
{
    constructor(playerCount: number) {
        if (playerCount < 1 || playerCount > 5) {
            throw new Error('Invalid player count')
        }

        super()

        if (playerCount < 5) {
            this.initializeOneToFourPlayers()
        } else {
            this.initializeFivePlayers()
        }
    }

    *[Symbol.iterator](): IterableIterator<SolNode> {
        const startNode = this.nodeAt({ col: 0, row: Ring.Core })
        const traverser = flood({
            start: startNode
        })
        const nodes = this.traverse(traverser)
        for (const node of nodes) {
            yield node
        }
    }

    *map<T>(callback: (node: SolNode) => T): IterableIterator<T> {
        for (const x of this) {
            yield callback(x)
        }
    }

    private initializeOneToFourPlayers() {
        this.createRingNodes(false)

        // Add In/Out edges
        this.addInnerOuterEdges(false)

        // Inner ring In
        for (let col = 0; col < ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Inner]; col++) {
            const node = this.nodeAt({ col, row: Ring.Inner })
            node.neighbors[Direction.In].push(
                ...[
                    { col, row: Ring.Convective },
                    { col: (col + 1) % 13, row: Ring.Convective }
                ]
            )
        }

        // Convective Out
        for (let col = 0; col < ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Convective]; col++) {
            const node = this.nodeAt({ col, row: Ring.Convective })
            node.neighbors[Direction.Out].push(
                ...[
                    { col: col === 0 ? 12 : col - 1, row: Ring.Inner },
                    { col, row: Ring.Inner }
                ]
            )
        }

        // The rest
        this.addCenterThreeRingEdges()
    }

    private initializeFivePlayers() {
        this.createRingNodes(true)

        // Add In/Out edges

        this.addInnerOuterEdges(false)

        // Inner ring In
        let innerOffset = 0
        for (let col = 0; col < FIVE_PLAYER_RING_COUNTS[Ring.Inner]; col++) {
            const node = this.nodeAt({ col, row: Ring.Inner })
            if (col === 5 || col === 10 || col === 15) {
                innerOffset -= 1
            }
            if (col !== 0 && col !== 5 && col !== 6 && col !== 10 && col !== 11 && col !== 15) {
                node.neighbors[Direction.In].push({
                    col: col + innerOffset - 1,
                    row: Ring.Convective
                })
            }
            node.neighbors[Direction.In].push({ col: col + innerOffset, row: Ring.Convective })
        }

        // Convective Out
        let convectiveOffset = 0
        for (let col = 0; col < FIVE_PLAYER_RING_COUNTS[Ring.Convective]; col++) {
            const node = this.nodeAt({ col, row: Ring.Convective })
            if (col === 5 || col === 9) {
                convectiveOffset += 1
            }
            node.neighbors[Direction.In].push({ col: col + convectiveOffset, row: Ring.Inner })
            node.neighbors[Direction.In].push({ col: col + convectiveOffset + 1, row: Ring.Inner })
        }

        // The rest
        this.addCenterThreeRingEdges()
    }

    private createRingNodes(fivePlayer: boolean) {
        for (let ring = 0; ring < 5; ring++) {
            const count = fivePlayer
                ? FIVE_PLAYER_RING_COUNTS[ring]
                : ONE_TO_FOUR_PLAYER_RING_COUNTS[ring]
            for (let col = 0; col < count; col++) {
                const clockwise = (col + 1) % count
                const counterClockwise = col === 0 ? count - 1 : col - 1
                this.addNode({
                    coords: { col, row: ring },
                    neighbors: {
                        [Direction.Out]: [],
                        [Direction.In]: [],
                        [Direction.Clockwise]: [{ col: clockwise, row: ring }],
                        [Direction.CounterClockwise]: [{ col: counterClockwise, row: ring }],
                        [Direction.Portal]: []
                    }
                })
            }
        }
    }

    private addInnerOuterEdges(fivePlayer: boolean) {
        // Outer ring In
        const count = fivePlayer
            ? FIVE_PLAYER_RING_COUNTS[Ring.Outer]
            : ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Outer]
        for (let col = 0; col < count; col++) {
            const node = this.nodeAt({ col, row: Ring.Outer })
            node.neighbors[Direction.In].push({ col, row: Ring.Inner })
        }

        // Inner ring Out
        for (let col = 0; col < count; col++) {
            const node = this.nodeAt({ col, row: Ring.Inner })
            node.neighbors[Direction.Out].push({ col, row: Ring.Outer })
        }
    }

    private addCenterThreeRingEdges() {
        for (const edge of IN_OUT_EDGES) {
            const [innerCoords, outerCoords] = edge
            const innerNode = this.nodeAt(innerCoords)
            const outerNode = this.nodeAt(outerCoords)
            innerNode.neighbors[Direction.Out].push(outerCoords)
            outerNode.neighbors[Direction.In].push(innerCoords)
        }
    }

    public override neighborsOf(coords: OffsetCoordinates, direction?: Direction): SolNode[] {
        if (!this.contains(coords)) {
            throw new Error('Invalid coordinates')
        }

        const startNode = this.nodeAt(coords)
        if (direction) {
            return startNode.neighbors[direction].map((coords) => this.nodeAt(coords))
        } else {
            return [
                ...startNode.neighbors[Direction.Out].map((coords) => this.nodeAt(coords)),
                ...startNode.neighbors[Direction.In].map((coords) => this.nodeAt(coords)),
                ...startNode.neighbors[Direction.Clockwise].map((coords) => this.nodeAt(coords)),
                ...startNode.neighbors[Direction.CounterClockwise].map((coords) =>
                    this.nodeAt(coords)
                ),
                ...startNode.neighbors[Direction.Portal].map((coords) => this.nodeAt(coords))
            ]
        }
    }
}
