export interface GraphNode<T> {
    id: string
    data?: T
    neighbors: GraphNode<T>[]
    addNeighbor(node: GraphNode<T>): void
    getNeighborIds(): string[]
}

export interface Graph<T> {}

export abstract class BaseGraph<T> implements Graph<T> {
    constructor(private nodes: GraphNode<T>[]) {
        this.createGraph()
    }

    private createGraph() {
        const nodeIndex = new Map<string, GraphNode<T>>()
        for (const node of this.nodes) {
            nodeIndex.set(node.id, node)
        }

        for (const node of this.nodes) {
            for (const neighborId of node.getNeighborIds()) {
                const neighborNode = nodeIndex.get(neighborId)
                if (neighborNode !== undefined) {
                    node.addNeighbor(neighborNode)
                }
            }
        }
    }
}

export enum CardinalDirection {
    North = 0,
    NorthEast = 1,
    East = 2,
    SouthEast = 3,
    South = 4,
    SouthWest = 5,
    West = 6,
    NorthWest = 7
}

export enum OrthoganalDirection {
    North = CardinalDirection.North,
    East = CardinalDirection.East,
    South = CardinalDirection.South,
    West = CardinalDirection.West
}

export enum IterationOrder {
    Any = 'any',
    Clockwise = 'clockwise',
    CounterClockwise = 'counterClockwise'
}

export class SquareTileNode<T> {
    private static readonly CLOCKWISE_ORDER = [
        CardinalDirection.North,
        CardinalDirection.NorthEast,
        CardinalDirection.East,
        CardinalDirection.SouthEast,
        CardinalDirection.South,
        CardinalDirection.SouthWest,
        CardinalDirection.West,
        CardinalDirection.NorthWest
    ]

    private id: string
    private neighbors: (SquareTileNode<T> | undefined)[] = new Array(
        SquareTileNode.CLOCKWISE_ORDER.length
    )

    constructor(
        public coords: [number, number],
        public data?: number
    ) {
        this.id = `${coords[0]},${coords[1]}`
    }

    getId(): string {
        return this.id
    }

    getNeighbor(direction: CardinalDirection): SquareTileNode<T> | undefined {
        return this.neighbors[direction]
    }

    setNeighbor(direction: CardinalDirection, node: SquareTileNode<T>): void {
        this.neighbors[direction] = node
    }

    getNeighbors({
        order = IterationOrder.Any,
        startDirection = CardinalDirection.North
    }: {
        order?: IterationOrder
        startDirection?: CardinalDirection
    }): Iterable<SquareTileNode<T> | undefined> {
        switch (order) {
            case IterationOrder.Any: {
                return this.neighbors
            }
            case IterationOrder.Clockwise: {
                throw new Error('Not implemented')
            }
            case IterationOrder.CounterClockwise: {
                throw new Error('Not implemented')
            }
        }
    }
}
