import { coordinatesToNumber, OffsetCoordinates } from '@tabletop/common'
import { BaseCoordinatedGraph, type CoordinatedGraph, type CoordinatedNode } from './graph.js'

export enum Direction {
    Out = 'O',
    In = 'I',
    Clockwise = 'C',
    CounterClockwise = 'CC',
    Portal = 'P' // For Portal Effect to connect nodes
}

export enum Ring {
    Center = 0,
    Core = 1,
    Radiative = 2,
    Convective = 3,
    Inner = 4,
    Outer = 5
}

export type SolNode = CoordinatedNode<OffsetCoordinates> & {
    neighbors: Record<Direction, OffsetCoordinates[]>
}

export const ONE_TO_FOUR_PLAYER_RING_COUNTS = [1, 5, 8, 13, 13, 13]
export const FIVE_PLAYER_RING_COUNTS = [1, 5, 8, 13, 16, 16]

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
    [{ col: 4, row: Ring.Core },{ col: 0, row: Ring.Radiative }],
    // Center to Core
    [{ col: 0, row: Ring.Center },{ col: 0, row: Ring.Core }],
    [{ col: 0, row: Ring.Center },{ col: 1, row: Ring.Core }],
    [{ col: 0, row: Ring.Center },{ col: 2, row: Ring.Core }],
    [{ col: 0, row: Ring.Center },{ col: 3, row: Ring.Core }],
    [{ col: 0, row: Ring.Center },{ col: 4, row: Ring.Core }],
]

export class SolGraph
    extends BaseCoordinatedGraph<SolNode, OffsetCoordinates>
    implements CoordinatedGraph<SolNode, OffsetCoordinates>
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

    private initializeOneToFourPlayers() {
        this.createRingNodes(false)

        // Add In/Out edges
        this.addInnerOuterEdges(false)

        // Inner ring In
        for (let col = 0; col < ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Inner]; col++) {
            const node = this.nodeAt({ col, row: Ring.Inner })
            if (node) {
                node.neighbors[Direction.In].push(
                    ...[
                        { col, row: Ring.Convective },
                        { col: (col + 1) % 13, row: Ring.Convective }
                    ]
                )
            }
        }

        // Convective Out
        for (let col = 0; col < ONE_TO_FOUR_PLAYER_RING_COUNTS[Ring.Convective]; col++) {
            const node = this.nodeAt({ col, row: Ring.Convective })
            if (node) {
                node.neighbors[Direction.Out].push(
                    ...[
                        { col: col === 0 ? 12 : col - 1, row: Ring.Inner },
                        { col, row: Ring.Inner }
                    ]
                )
            }
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
            if (!node) {
                continue
            }
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
            if (!node) {
                continue
            }
            if (col === 5 || col === 9) {
                convectiveOffset += 1
            }
            node.neighbors[Direction.Out].push({ col: col + convectiveOffset, row: Ring.Inner })
            node.neighbors[Direction.Out].push({ col: col + convectiveOffset + 1, row: Ring.Inner })
        }

        // The rest
        this.addCenterThreeRingEdges()
    }

    private createRingNodes(fivePlayer: boolean) {
        for (let ring = Ring.Center; ring <= Ring.Outer; ring++) {
            const count = fivePlayer
                ? FIVE_PLAYER_RING_COUNTS[ring]
                : ONE_TO_FOUR_PLAYER_RING_COUNTS[ring]
            for (let col = 0; col < count; col++) {
                const clockwise = (col + 1) % count
                const counterClockwise = col === 0 ? count - 1 : col - 1
                const coords = { col, row: ring }
                this.addNode({
                    id: coordinatesToNumber(coords),
                    coords: coords,
                    neighbors: {
                        [Direction.Out]: [],
                        [Direction.In]: [],
                        [Direction.Clockwise]: count > 1 ? [{ col: clockwise, row: ring }] : [],
                        [Direction.CounterClockwise]:
                            count > 1 ? [{ col: counterClockwise, row: ring }] : [],
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
            if (!node) {
                continue
            }
            node.neighbors[Direction.In].push({ col, row: Ring.Inner })
        }

        // Inner ring Out
        for (let col = 0; col < count; col++) {
            const node = this.nodeAt({ col, row: Ring.Inner })
            if (!node) {
                continue
            }
            node.neighbors[Direction.Out].push({ col, row: Ring.Outer })
        }
    }

    private addCenterThreeRingEdges() {
        for (const edge of IN_OUT_EDGES) {
            const [innerCoords, outerCoords] = edge
            const innerNode = this.nodeAt(innerCoords)
            const outerNode = this.nodeAt(outerCoords)
            if (!innerNode || !outerNode) {
                continue
            }
            innerNode.neighbors[Direction.Out].push(outerCoords)
            outerNode.neighbors[Direction.In].push(innerCoords)
        }
    }
    public override neighborsAt(coords: OffsetCoordinates, direction?: Direction): SolNode[] {
        const startNode = this.nodeAt(coords)
        if (!startNode) {
            return []
        }
        return this.neighborsOf(startNode, direction)
    }
    public override neighborsOf(node: SolNode, direction?: Direction): SolNode[] {
        if (direction) {
            return node.neighbors[direction]
                .map((coords) => this.nodeAt(coords))
                .filter((node) => node !== undefined)
        } else {
            return [
                ...node.neighbors[Direction.Out]
                    .map((coords) => this.nodeAt(coords))
                    .filter((node) => node !== undefined),
                ...node.neighbors[Direction.In]
                    .map((coords) => this.nodeAt(coords))
                    .filter((node) => node !== undefined),
                ...node.neighbors[Direction.Clockwise]
                    .map((coords) => this.nodeAt(coords))
                    .filter((node) => node !== undefined),
                ...node.neighbors[Direction.CounterClockwise]
                    .map((coords) => this.nodeAt(coords))
                    .filter((node) => node !== undefined),
                ...node.neighbors[Direction.Portal]
                    .map((coords) => this.nodeAt(coords))
                    .filter((node) => node !== undefined)
            ]
        }
    }
}
