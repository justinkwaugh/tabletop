import { Cell, CellType, isDiskCell, MarketCell } from '../components/cells.js'
import { Coordinates, HydratedGameBoard } from '../components/gameBoard.js'

export type ReturnedDisks = Record<string, number>
export class Expropriator {
    nodes: Node[] = []

    constructor(
        private board: HydratedGameBoard,
        testCoords?: Coordinates
    ) {
        this.createGraph(testCoords)
    }

    calculateExpropriation(): {
        expropriatedCoords: Coordinates[]
        returnedDisks: ReturnedDisks
    } {
        const expectedCount = this.nodes.length - 1
        const expropriated: Node[] = []
        for (const node of this.nodes) {
            // Only check nodes we can block
            if (!node.isBlockable()) {
                continue
            }

            // Temporarily set the cell to be non-traversable
            const originalCellType = node.cell.type
            node.cell.type = CellType.OffBoard // Any non-traversable cell type will work

            // See if we can traverse the whole graph without this node, otherwise expropriate
            const { numTraversed } = this.traverseGraph()
            if (numTraversed !== expectedCount) {
                expropriated.push(node)
            }
            // Restore it
            node.cell.type = originalCellType
        }
        const expropriatedCoords = expropriated.map((n) => n.coords)
        const returnedDisks: ReturnedDisks = {}
        for (const node of expropriated) {
            if (isDiskCell(node.cell)) {
                returnedDisks[node.cell.playerId] = (returnedDisks[node.cell.playerId] ?? 0) + 1
            }
        }
        return { expropriatedCoords, returnedDisks }
    }

    private createGraph(testCoords?: Coordinates): void {
        const nodeIndex = new Map<string, Node>()
        for (const boardCell of this.board) {
            const cell = this.isTestCell(boardCell.coords, testCoords)
                ? <MarketCell>{ type: CellType.Market }
                : boardCell.cell
            const node = new Node(boardCell.coords, cell)
            if (node.isRequiredToReach()) {
                this.nodes.push(node)
                nodeIndex.set(node.id, node)
            }
        }

        for (const node of this.nodes) {
            for (const neighborId of node.neighborIds()) {
                const neighborNode = nodeIndex.get(neighborId)
                if (neighborNode !== undefined) {
                    node.addNeighbor(neighborNode)
                }
            }
        }
    }

    private isTestCell(coords: Coordinates, testCoords?: Coordinates): boolean {
        return (
            testCoords !== undefined && coords[0] === testCoords[0] && coords[1] === testCoords[1]
        )
    }

    private traverseGraph(): { numTraversed: number } {
        const startNode = this.nodes.find((n) => n.isTraversable())
        if (!startNode) {
            throw new Error('Could not find a traversable node to start on')
        }
        const queue: Node[] = [startNode]
        const visitedNodeIds = new Set<string>()

        while (queue.length > 0) {
            const currentNode = queue.pop()! // It is impossible for queue to be empty here
            visitedNodeIds.add(currentNode.id)
            if (!currentNode.isTraversable()) {
                continue
            }
            for (const neighbor of currentNode.getNeighbors()) {
                if (!visitedNodeIds.has(neighbor.id)) {
                    if (neighbor.isTraversable()) {
                        queue.push(neighbor)
                    } else if (neighbor.isRequiredToReach()) {
                        visitedNodeIds.add(neighbor.id)
                    }
                }
            }
        }

        return { numTraversed: visitedNodeIds.size }
    }
}

class Node {
    id: string
    cell: Cell
    private neighbors: Node[] = []

    constructor(
        public readonly coords: Coordinates,
        cell: Cell
    ) {
        this.cell = cell
        this.id = Node.coordsToId(coords)
    }

    addNeighbor(node: Node): void {
        this.neighbors.push(node)
    }

    getNeighbors(): Node[] {
        return this.neighbors
    }

    isTraversable(): boolean {
        return (
            this.cell.type === CellType.Empty ||
            this.cell.type === CellType.Road ||
            this.cell.type === CellType.Disk
        )
    }

    isRequiredToReach(): boolean {
        return (
            this.cell.type === CellType.Empty ||
            this.cell.type === CellType.Road ||
            this.cell.type === CellType.Disk ||
            this.cell.type === CellType.Stall ||
            this.cell.type === CellType.Truck
        )
    }

    isBlockable(): boolean {
        return this.cell.type === CellType.Empty || this.cell.type === CellType.Disk
    }

    neighborIds(): string[] {
        return [
            Node.coordsToId([this.coords[0] + 1, this.coords[1]]),
            Node.coordsToId([this.coords[0] - 1, this.coords[1]]),
            Node.coordsToId([this.coords[0], this.coords[1] + 1]),
            Node.coordsToId([this.coords[0], this.coords[1] - 1])
        ]
    }

    static coordsToId(coords: Coordinates): string {
        return `${coords[0]},${coords[1]}`
    }
}
